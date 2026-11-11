import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import { CredencialesInvalidasError, SinEmpresaError } from '../../domain/errors/auth.errors.js';
import { separarTokenRefresco } from '../../domain/value-objects/token-refresco.js';
import {
  ConsultarEmpresasDePrueba,
  ContextoDePrueba,
  GeneradorTokensDePrueba,
  HasherDePrueba,
  idDePrueba,
  RolesEnMemoria,
  SesionesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import { IniciarSesionUseCase, MotivoLoginFallido } from './iniciar-sesion.use-case.js';

const CONTRASENA = 'Margarita-Lunes-47';
const ALFA = { id: idDePrueba(1), nombre: 'Alfa Comercial', activo: true };
const BETA = { id: idDePrueba(2), nombre: 'Beta Servicios', activo: true };
const CERRADA = { id: idDePrueba(3), nombre: 'Aaa Cerrada', activo: false };

describe('IniciarSesionUseCase', () => {
  let reloj: RelojFijo;
  let usuarios: UsuariosEnMemoria;
  let roles: RolesEnMemoria;
  let sesiones: SesionesEnMemoria;
  let hasher: HasherDePrueba;
  let auditoria: AuditoriaEnMemoria;
  /** Cómo terminó cada transacción: si el error salió desde adentro, la real la desharía. */
  let transacciones: ('confirmada' | 'deshecha')[];
  let casoDeUso: IniciarSesionUseCase;

  beforeEach(() => {
    reloj = new RelojFijo('2026-07-15T08:00:00-05:00');
    usuarios = new UsuariosEnMemoria();
    roles = new RolesEnMemoria();
    sesiones = new SesionesEnMemoria();
    hasher = new HasherDePrueba();
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
    casoDeUso = new IniciarSesionUseCase(
      usuarios,
      roles,
      sesiones,
      hasher,
      new GeneradorTokensDePrueba(),
      { duracionMaximaHoras: 13, inactividadMinutos: 120 },
      new ConsultarEmpresasDePrueba([ALFA, BETA, CERRADA]),
      new ContextoDePrueba(),
      reloj,
      unidad,
      auditoria,
    );
  });

  function ana(cambios: Parameters<UsuariosEnMemoria['agregar']>[1] = {}) {
    return usuarios.agregar('ana', { hashContrasena: `hash(${CONTRASENA})`, ...cambios });
  }

  const entrar = (nombreUsuario = 'ana', contrasena = CONTRASENA) =>
    casoDeUso.execute({ nombreUsuario, contrasena });

  describe('con la contraseña correcta', () => {
    it('crea la sesión, entrega los tokens y lo registra', async () => {
      const usuario = ana();
      await roles.darRol(usuario.id, ALFA.id);

      const tokens = await entrar(' Ana ');

      const [sesion] = [...sesiones.filas.values()];
      expect(sesion?.datos()).toMatchObject({
        usuarioId: usuario.id,
        empresaId: ALFA.id,
        iniciadaEn: reloj.ahora(),
        ultimoUsoEn: reloj.ahora(),
        venceEn: new Date('2026-07-15T21:00:00-05:00'),
        ip: '10.0.0.7',
        navegador: 'Navegador de prueba',
        cerradaEn: null,
      });
      expect(tokens).toEqual({
        tokenAcceso: `acceso(${usuario.id},${sesion?.id})`,
        expiraEnSegundos: 900,
        tokenRefresco: expect.any(String),
        sesionVenceEn: new Date('2026-07-15T21:00:00-05:00'),
        debeCambiarContrasena: false,
      });
      // En la base queda la huella del secreto que va en la cookie, nunca el secreto.
      const partes = separarTokenRefresco(tokens.tokenRefresco);
      expect(partes?.sesionId).toBe(sesion?.id);
      expect(sesion?.datos().hashRefresh).toBe(`huella(${partes?.secreto})`);

      expect(auditoria.acciones()).toEqual(['auth.sesion.iniciar']);
      expect(auditoria.ultimo()).toMatchObject({
        empresaId: ALFA.id,
        usuarioId: usuario.id,
        nombreUsuario: 'ana',
        entidad: 'sesion',
        entidadId: sesion?.id,
        despues: { empresa: 'Alfa Comercial', venceEn: '2026-07-16T02:00:00.000Z' },
        ip: '10.0.0.7',
        requestId: 'peticion-1',
      });
    });

    it('pone en cero los fallos y guarda el ingreso y la empresa', async () => {
      const usuario = ana({ intentosFallidos: 3 });
      await roles.darRol(usuario.id, BETA.id);

      await entrar();

      const guardado = await usuarios.buscarPorId(usuario.id);
      expect(guardado?.datos()).toMatchObject({
        intentosFallidos: 0,
        bloqueadoHasta: null,
        ultimoIngresoEn: reloj.ahora(),
        ultimaEmpresaId: BETA.id,
      });
    });

    it('entra a la última empresa usada si todavía tiene acceso (AUTH-D4)', async () => {
      const usuario = ana({ ultimaEmpresaId: BETA.id });
      await roles.darRol(usuario.id, ALFA.id);
      await roles.darRol(usuario.id, BETA.id);

      await entrar();

      expect([...sesiones.filas.values()][0]?.empresaId).toBe(BETA.id);
    });

    it('si no, a la primera por nombre entre las activas', async () => {
      const usuario = ana({ ultimaEmpresaId: CERRADA.id });
      await roles.darRol(usuario.id, BETA.id);
      await roles.darRol(usuario.id, ALFA.id);
      await roles.darRol(usuario.id, CERRADA.id);

      await entrar();

      expect([...sesiones.filas.values()][0]?.empresaId).toBe(ALFA.id);
    });

    it('avisa si debe cambiar la contraseña (AUTH-D14)', async () => {
      const usuario = ana({ debeCambiarContrasena: true });
      await roles.darRol(usuario.id, ALFA.id);

      expect((await entrar()).debeCambiarContrasena).toBe(true);
    });

    it('sin un rol activo en una empresa activa: SinEmpresaError, no crea sesión y lo registra sin sumar al bloqueo (AUTH-D16, AUD-01)', async () => {
      const usuario = ana({ intentosFallidos: 2, ultimaEmpresaId: ALFA.id });
      await roles.darRol(usuario.id, CERRADA.id);
      await roles.darRol(usuario.id, ALFA.id, { activo: false });

      await expect(entrar()).rejects.toThrow(SinEmpresaError);

      expect(sesiones.filas.size).toBe(0);
      expect(usuarios.filas.get(usuario.id)?.usuario.intentosFallidos).toBe(2);
      expect(auditoria.acciones()).toEqual(['auth.sesion.fallido']);
      expect(auditoria.ultimo()).toMatchObject({
        empresaId: ALFA.id,
        usuarioId: usuario.id,
        nombreUsuario: 'ana',
        entidad: 'usuario',
        entidadId: usuario.id,
        entidadNombre: 'ana',
        despues: { motivo: MotivoLoginFallido.SIN_EMPRESA },
        ip: '10.0.0.7',
      });
    });

    it('sin empresa y sin una última empresa: el evento queda sin empresa', async () => {
      ana();
      await expect(entrar()).rejects.toThrow(SinEmpresaError);
      expect(auditoria.ultimo()).toMatchObject({
        empresaId: null,
        despues: { motivo: MotivoLoginFallido.SIN_EMPRESA },
      });
    });

    it('sin empresa con la contraseña incorrecta: es un fallo común (401, suma)', async () => {
      const usuario = ana();
      await expect(entrar('ana', 'otra-cosa')).rejects.toThrow(CredencialesInvalidasError);
      expect(usuarios.filas.get(usuario.id)?.usuario.intentosFallidos).toBe(1);
      expect(auditoria.ultimo()?.despues).toMatchObject({
        motivo: MotivoLoginFallido.CONTRASENA_INCORRECTA,
      });
    });

    it('al terminar el bloqueo vuelve a entrar', async () => {
      const usuario = ana({ bloqueadoHasta: new Date('2026-07-15T08:00:00-05:00') });
      await roles.darRol(usuario.id, ALFA.id);

      await expect(entrar()).resolves.toMatchObject({ debeCambiarContrasena: false });
    });
  });

  describe('un login fallido responde siempre lo mismo (AUTH-D15)', () => {
    it('usuario que no existe: verifica un hash de relleno y registra solo la IP y el navegador', async () => {
      await expect(entrar('nadie', 'loquesea')).rejects.toThrow(CredencialesInvalidasError);

      expect(hasher.rellenos).toBe(1);
      expect(auditoria.acciones()).toEqual(['auth.sesion.fallido']);
      expect(auditoria.ultimo()).toMatchObject({
        empresaId: null,
        usuarioId: null,
        nombreUsuario: null,
        entidad: null,
        entidadId: null,
        despues: { motivo: MotivoLoginFallido.NO_EXISTE },
        ip: '10.0.0.7',
      });
      // Lo que escribió no se guarda (puede ser la contraseña en el campo equivocado).
      expect(JSON.stringify(auditoria.eventos)).not.toContain('nadie');
      expect(transacciones).toEqual(['confirmada']);
    });

    it('un nombre con formato imposible se trata igual que uno que no existe', async () => {
      await expect(entrar('a b', CONTRASENA)).rejects.toThrow(CredencialesInvalidasError);
      expect(hasher.rellenos).toBe(1);
      expect(auditoria.ultimo().despues).toEqual({ motivo: 'NO_EXISTE' });
    });

    it('contraseña mal: suma el fallo y lo registra en su última empresa, confirmado antes del error', async () => {
      const usuario = ana({ ultimaEmpresaId: ALFA.id, intentosFallidos: 1 });

      await expect(entrar('ana', 'otra-cosa')).rejects.toThrow(CredencialesInvalidasError);

      expect((await usuarios.buscarPorId(usuario.id))?.intentosFallidos).toBe(2);
      expect(hasher.rellenos).toBe(0);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.sesion.fallido',
        empresaId: ALFA.id,
        usuarioId: usuario.id,
        entidad: 'usuario',
        entidadId: usuario.id,
        despues: { motivo: 'CONTRASENA_INCORRECTA', intentosFallidos: 2 },
      });
      expect(transacciones).toEqual(['confirmada']);
      expect(sesiones.filas.size).toBe(0);
    });

    it('al quinto fallo seguido bloquea 15 minutos y lo registra', async () => {
      const usuario = ana({ intentosFallidos: 4 });

      await expect(entrar('ana', 'otra-cosa')).rejects.toThrow(CredencialesInvalidasError);

      const guardado = await usuarios.buscarPorId(usuario.id);
      expect(guardado?.bloqueadoHasta).toEqual(new Date('2026-07-15T08:15:00-05:00'));
      expect(auditoria.acciones()).toEqual(['auth.sesion.fallido', 'auth.usuario.bloquear']);
      expect(auditoria.ultimo().despues).toEqual({ bloqueadoHasta: '2026-07-15T13:15:00.000Z' });
    });

    it('bloqueado: ni con la contraseña correcta entra, y el bloqueo no se alarga', async () => {
      const hasta = new Date('2026-07-15T08:10:00-05:00');
      const usuario = ana({ bloqueadoHasta: hasta });
      await roles.darRol(usuario.id, ALFA.id);

      await expect(entrar()).rejects.toThrow(CredencialesInvalidasError);

      expect((await usuarios.buscarPorId(usuario.id))?.bloqueadoHasta).toEqual(hasta);
      expect(auditoria.ultimo().despues).toEqual({ motivo: 'BLOQUEADO', intentosFallidos: 0 });
      expect(sesiones.filas.size).toBe(0);
    });

    it('desactivado: no entra ni suma fallos', async () => {
      const usuario = ana({ activo: false });
      await roles.darRol(usuario.id, ALFA.id);

      await expect(entrar()).rejects.toThrow(CredencialesInvalidasError);

      expect((await usuarios.buscarPorId(usuario.id))?.intentosFallidos).toBe(0);
      expect(auditoria.ultimo().despues).toEqual({ motivo: 'DESACTIVADO', intentosFallidos: 0 });
    });

    it('todos los motivos dan el mismo mensaje', async () => {
      ana({ intentosFallidos: 0 });
      usuarios.agregar('bloqueado', {
        hashContrasena: `hash(${CONTRASENA})`,
        bloqueadoHasta: new Date('2026-07-15T09:00:00-05:00'),
      });
      usuarios.agregar('inactivo', { hashContrasena: `hash(${CONTRASENA})`, activo: false });
      const mensajes = await Promise.all(
        [
          ['nadie', CONTRASENA],
          ['ana', 'otra-cosa'],
          ['bloqueado', CONTRASENA],
          ['inactivo', CONTRASENA],
        ].map(([nombre = '', contrasena = '']) =>
          entrar(nombre, contrasena).catch((error: unknown) => (error as Error).message),
        ),
      );
      expect(new Set(mensajes)).toEqual(new Set([new CredencialesInvalidasError().message]));
    });
  });
});
