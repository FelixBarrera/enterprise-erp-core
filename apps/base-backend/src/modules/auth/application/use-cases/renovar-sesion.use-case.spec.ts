import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import type { Sesion } from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import { SesionInvalidaError } from '../../domain/errors/auth.errors.js';
import { separarTokenRefresco } from '../../domain/value-objects/token-refresco.js';
import {
  ConsultarEmpresasDePrueba,
  ContextoDePrueba,
  GeneradorTokensDePrueba,
  idDePrueba,
  RolesEnMemoria,
  SesionesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import { RenovarSesionUseCase } from './renovar-sesion.use-case.js';

const ALFA = { id: idDePrueba(1), nombre: 'Alfa Comercial', activo: true };
const SECRETO = 'secreto-original'.padEnd(43, 'x');
const INICIO = new Date('2026-07-15T08:00:00-05:00');

describe('RenovarSesionUseCase', () => {
  let reloj: RelojFijo;
  let usuarios: UsuariosEnMemoria;
  let roles: RolesEnMemoria;
  let sesiones: SesionesEnMemoria;
  let tokens: GeneradorTokensDePrueba;
  let empresas: ConsultarEmpresasDePrueba;
  let auditoria: AuditoriaEnMemoria;
  let transacciones: ('confirmada' | 'deshecha')[];
  let casoDeUso: RenovarSesionUseCase;
  let usuario: Usuario;
  let sesion: Sesion;

  beforeEach(async () => {
    reloj = new RelojFijo('2026-07-15T08:10:00-05:00');
    usuarios = new UsuariosEnMemoria();
    roles = new RolesEnMemoria();
    sesiones = new SesionesEnMemoria();
    tokens = new GeneradorTokensDePrueba();
    empresas = new ConsultarEmpresasDePrueba([{ ...ALFA }]);
    auditoria = new AuditoriaEnMemoria(reloj);
    transacciones = [];
    const unidad = {
      ejecutar: async <T>(fn: () => Promise<T>): Promise<T> => {
        try {
          const resultado = await fn();
          transacciones.push('confirmada');
          return resultado;
        } catch (error) {
          transacciones.push('deshecha');
          throw error;
        }
      },
    };
    casoDeUso = new RenovarSesionUseCase(
      sesiones,
      usuarios,
      roles,
      tokens,
      { duracionMaximaHoras: 13, inactividadMinutos: 120 },
      empresas,
      new ContextoDePrueba(),
      reloj,
      unidad,
      auditoria,
    );
    usuario = usuarios.agregar('ana', { debeCambiarContrasena: true });
    await roles.darRol(usuario.id, ALFA.id);
    sesion = sesiones.agregar({
      usuarioId: usuario.id,
      empresaId: ALFA.id,
      iniciadaEn: INICIO,
      hashRefresh: tokens.huella(SECRETO),
    });
  });

  const token = (secreto = SECRETO, sid = sesion.id) =>
    tokens.armarRefresco({ sesionId: sid, secreto });
  const guardada = (id = sesion.id) => sesiones.filas.get(id)?.datos();

  it('con el token vigente: rota el secreto, cuenta el uso y entrega tokens nuevos', async () => {
    const renovada = await casoDeUso.execute(token());

    const partes = separarTokenRefresco(renovada.tokenRefresco);
    expect(partes?.sesionId).toBe(sesion.id);
    expect(partes?.secreto).not.toBe(SECRETO);
    expect(guardada()).toMatchObject({
      hashRefresh: tokens.huella(partes?.secreto ?? ''),
      hashRefreshAnterior: tokens.huella(SECRETO),
      rotadoEn: reloj.ahora(),
      ultimoUsoEn: reloj.ahora(),
    });
    expect(renovada).toMatchObject({
      tokenAcceso: `acceso(${usuario.id},${sesion.id})`,
      expiraEnSegundos: 900,
      sesionVenceEn: sesion.venceEn,
      debeCambiarContrasena: true,
    });
    // El refresh no va a la bitácora.
    expect(auditoria.eventos).toHaveLength(0);
  });

  it('con el anterior dentro de los 60 s: rota igual (la respuesta se perdió)', async () => {
    const primera = await casoDeUso.execute(token());
    reloj.fijar('2026-07-15T08:11:00-05:00');

    const segunda = await casoDeUso.execute(token());

    expect(segunda.tokenRefresco).not.toBe(primera.tokenRefresco);
    expect(guardada()?.cerradaEn).toBeNull();
    expect(auditoria.eventos).toHaveLength(0);
  });

  describe('reuso (AUTH-D7)', () => {
    it('el anterior después de los 60 s cierra TODAS las sesiones del usuario y lo registra', async () => {
      const otra = sesiones.agregar({ usuarioId: usuario.id, empresaId: ALFA.id });
      const deOtroUsuario = sesiones.agregar({ usuarioId: idDePrueba(999), empresaId: ALFA.id });
      await casoDeUso.execute(token());
      reloj.fijar('2026-07-15T08:11:01-05:00');

      await expect(casoDeUso.execute(token())).rejects.toThrow(SesionInvalidaError);

      expect(guardada()).toMatchObject({ cerradaEn: reloj.ahora(), motivoCierre: 'REUSO' });
      expect(guardada(otra.id)).toMatchObject({ motivoCierre: 'REUSO' });
      expect(guardada(deOtroUsuario.id)?.cerradaEn).toBeNull();
      expect(auditoria.acciones()).toEqual(['auth.sesion.reuso']);
      expect(auditoria.ultimo()).toMatchObject({
        empresaId: ALFA.id,
        usuarioId: usuario.id,
        entidad: 'sesion',
        entidadId: sesion.id,
        despues: { sesionesCerradas: 2, motivoCierre: 'REUSO' },
        ip: '10.0.0.7',
      });
      // El cierre se confirma: el 401 sale después de la transacción.
      expect(transacciones.at(-1)).toBe('confirmada');
    });

    it('un secreto que nunca fue de la sesión también es reuso', async () => {
      await expect(casoDeUso.execute(token('inventado'.padEnd(43, 'y')))).rejects.toThrow(
        SesionInvalidaError,
      );
      expect(guardada()?.motivoCierre).toBe('REUSO');
    });

    it('si el usuario ya no existe, igual cierra y registra (como el sistema)', async () => {
      usuarios.filas.delete(usuario.id);
      await expect(casoDeUso.execute(token('inventado'.padEnd(43, 'y')))).rejects.toThrow(
        SesionInvalidaError,
      );
      expect(auditoria.ultimo()).toMatchObject({ usuarioId: null, empresaId: ALFA.id });
    });
  });

  describe('sesión inválida, sin cambiar nada', () => {
    it.each([
      ['sin cookie', null],
      ['con un token mal formado', 'basura'],
      ['sin firma (la forma de antes del 6.13f)', `${idDePrueba(301)}.${SECRETO}`],
    ])('%s', async (_caso, valor) => {
      await expect(casoDeUso.execute(valor)).rejects.toThrow(SesionInvalidaError);
      expect(guardada()?.hashRefresh).toBe(tokens.huella(SECRETO));
      expect(auditoria.eventos).toHaveLength(0);
    });

    it('de una sesión que no existe', async () => {
      await expect(casoDeUso.execute(token(SECRETO, idDePrueba(398)))).rejects.toThrow(
        SesionInvalidaError,
      );
      expect(auditoria.eventos).toHaveLength(0);
    });

    // SEG-05: el `sid` se ve en la ficha del usuario y en la bitácora. Un token armado con ese
    // `sid` y otro secreto (o con la firma de otro token) no es del servidor: no es reuso.
    it.each([
      [
        'un secreto inventado y una firma inventada',
        () => `${sesion.id}.${'y'.repeat(43)}.${'z'.repeat(43)}`,
      ],
      [
        'un secreto inventado y la firma de un token de verdad',
        () => `${sesion.id}.${'y'.repeat(43)}.${token().split('.')[2] ?? ''}`,
      ],
      [
        'el secreto de verdad y la firma de otra sesión',
        () => `${sesion.id}.${SECRETO}.${token(SECRETO, idDePrueba(398)).split('.')[2] ?? ''}`,
      ],
    ])('con el sid real, %s: 401 sin cerrar nada', async (_caso, inventado) => {
      const otra = sesiones.agregar({ usuarioId: usuario.id, empresaId: ALFA.id });

      await expect(casoDeUso.execute(inventado())).rejects.toThrow(SesionInvalidaError);

      expect(guardada()).toMatchObject({ cerradaEn: null, hashRefresh: tokens.huella(SECRETO) });
      expect(guardada(otra.id)?.cerradaEn).toBeNull();
      expect(auditoria.eventos).toHaveLength(0);
      expect(transacciones).toEqual([]);
      // Y el token de verdad sigue sirviendo.
      await expect(casoDeUso.execute(token())).resolves.toMatchObject({ expiraEnSegundos: 900 });
    });

    it('cerrada (aunque el token sea el vigente)', async () => {
      await sesiones.guardar(sesion.cerrar('SALIDA', reloj.ahora()));
      await expect(casoDeUso.execute(token())).rejects.toThrow(SesionInvalidaError);
      expect(auditoria.eventos).toHaveLength(0);
    });

    it('vencida por el máximo de la jornada', async () => {
      reloj.fijar('2026-07-15T21:00:00-05:00');
      await sesiones.guardar(
        sesion.rotar(tokens.huella(SECRETO), new Date('2026-07-15T20:30:00-05:00')),
      );
      await expect(casoDeUso.execute(token())).rejects.toThrow(SesionInvalidaError);
    });

    it('sin uso por 120 minutos', async () => {
      reloj.fijar('2026-07-15T10:00:00-05:00');
      await expect(casoDeUso.execute(token())).rejects.toThrow(SesionInvalidaError);
      expect(guardada()?.cerradaEn).toBeNull();
    });

    it('usuario desactivado', async () => {
      await usuarios.guardar(usuario.desactivar());
      await expect(casoDeUso.execute(token())).rejects.toThrow(SesionInvalidaError);
    });

    it('empresa desactivada', async () => {
      empresas.empresas[0] = { ...ALFA, activo: false };
      await expect(casoDeUso.execute(token())).rejects.toThrow(SesionInvalidaError);
    });

    it('ya no tiene ningún rol activo en la empresa de la sesión', async () => {
      roles.asignaciones.clear();
      await expect(casoDeUso.execute(token())).rejects.toThrow(SesionInvalidaError);
    });
  });
});
