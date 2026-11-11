import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import type { Sesion } from '../../domain/entities/sesion.entity.js';
import { MotivoCierreSesion } from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  DebeCambiarContrasenaError,
  SesionInvalidaError,
  SinPermisoError,
} from '../../domain/errors/auth.errors.js';
import {
  AccesosSesionEnMemoria,
  ConsultarEmpresasDePrueba,
  ContextoDePrueba,
  GeneradorTokensDePrueba,
  idDePrueba,
  PermisosEnMemoria,
  RolesEnMemoria,
  SesionesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import { AutenticarPeticionUseCase } from './autenticar-peticion.use-case.js';

const ALFA = { id: idDePrueba(1), nombre: 'Alfa Comercial', activo: true };
const INICIO = new Date('2026-07-15T08:00:00-05:00');

describe('AutenticarPeticionUseCase', () => {
  let reloj: RelojFijo;
  let usuarios: UsuariosEnMemoria;
  let roles: RolesEnMemoria;
  let sesiones: SesionesEnMemoria;
  let empresas: ConsultarEmpresasDePrueba;
  let permisos: PermisosEnMemoria;
  let casoDeUso: AutenticarPeticionUseCase;
  let usuario: Usuario;
  let sesion: Sesion;

  beforeEach(async () => {
    reloj = new RelojFijo('2026-07-15T08:10:00-05:00');
    usuarios = new UsuariosEnMemoria();
    roles = new RolesEnMemoria();
    sesiones = new SesionesEnMemoria();
    empresas = new ConsultarEmpresasDePrueba([{ ...ALFA }]);
    permisos = new PermisosEnMemoria(roles);
    casoDeUso = new AutenticarPeticionUseCase(
      new GeneradorTokensDePrueba(),
      new AccesosSesionEnMemoria(sesiones, usuarios, roles, empresas, permisos),
      { duracionMaximaHoras: 13, inactividadMinutos: 120 },
      new ContextoDePrueba(),
      reloj,
    );
    usuario = usuarios.agregar('ana');
    await roles.darRol(usuario.id, ALFA.id);
    sesion = sesiones.agregar({ usuarioId: usuario.id, empresaId: ALFA.id, iniciadaEn: INICIO });
  });

  const token = (usuarioId = usuario.id, sesionId = sesion.id) =>
    `acceso(${usuarioId},${sesionId})`;
  const autenticar = (
    tokenAcceso: string | null = token(),
    permiteContrasenaTemporal = false,
    permisoRequerido: string | null = null,
  ) => casoDeUso.execute({ tokenAcceso, permiteContrasenaTemporal, permisoRequerido });
  const conPermiso = (codigo: string) => autenticar(token(), false, codigo);

  it('con todo en orden deja el actor (empresa de la sesión y datos de la petición)', async () => {
    await expect(autenticar()).resolves.toEqual({
      sesionId: sesion.id,
      esAdministrador: false,
      actor: {
        usuarioId: usuario.id,
        nombreUsuario: 'ana',
        empresaId: ALFA.id,
        ip: '10.0.0.7',
        navegador: 'Navegador de prueba',
        requestId: 'peticion-1',
      },
    });
  });

  it('dice si tiene el rol Administrador de la empresa activa', async () => {
    await roles.darRol(usuario.id, ALFA.id, { nombre: 'Administrador', esAdministrador: true });
    await expect(autenticar()).resolves.toMatchObject({ esAdministrador: true });
  });

  it('no escribe nada: el último uso solo se mueve en el refresh (AUTH-D8)', async () => {
    reloj.avanzarMinutos(30);
    await autenticar();
    expect(sesiones.filas.get(sesion.id)?.datos().ultimoUsoEn).toEqual(INICIO);
  });

  describe('responde 401 (siempre el mismo error)', () => {
    it.each([
      ['sin token', () => null],
      ['con un token que no se puede verificar', () => 'cualquier-cosa'],
      ['con una sesión que no existe', () => token(usuario.id, idDePrueba(999))],
    ])('%s', async (_caso, elToken) => {
      await expect(autenticar(elToken())).rejects.toThrow(SesionInvalidaError);
    });

    it('si el usuario del token no es el de la sesión', async () => {
      const otro = usuarios.agregar('beto');
      await expect(autenticar(token(otro.id))).rejects.toThrow(SesionInvalidaError);
    });

    it('con la sesión cerrada', async () => {
      sesiones.filas.set(sesion.id, sesion.cerrar(MotivoCierreSesion.SALIDA, reloj.ahora()));
      await expect(autenticar()).rejects.toThrow(SesionInvalidaError);
    });

    it('con la sesión vencida (13 horas) o sin uso por 120 minutos (justo en el límite)', async () => {
      reloj.fijar(new Date(INICIO.getTime() + 120 * 60_000));
      await expect(autenticar()).rejects.toThrow(SesionInvalidaError);
      sesiones.filas.set(
        sesion.id,
        sesion.rotar('huella-nueva', new Date(INICIO.getTime() + 12.5 * 3_600_000)),
      );
      reloj.fijar(new Date(INICIO.getTime() + 13 * 3_600_000));
      await expect(autenticar()).rejects.toThrow(SesionInvalidaError);
    });

    it('con el usuario desactivado', async () => {
      await usuarios.guardar(usuario.desactivar());
      await expect(autenticar()).rejects.toThrow(SesionInvalidaError);
    });

    it('con la empresa desactivada', async () => {
      empresas.empresas[0] = { ...ALFA, activo: false };
      await expect(autenticar()).rejects.toThrow(SesionInvalidaError);
    });

    it('sin un rol activo en la empresa de la sesión', async () => {
      const [rol] = await roles.rolesDeUsuario(usuario.id, ALFA.id);
      if (rol === undefined) {
        throw new Error('falta el rol');
      }
      roles.roles.set(rol.id, rol.desactivar());
      await expect(autenticar()).rejects.toThrow(SesionInvalidaError);
    });
  });

  describe('con contraseña temporal (AUTH-D14)', () => {
    beforeEach(async () => {
      await usuarios.guardar(usuario.cambiarContrasena('hash', true));
    });

    it('en una ruta común responde 403', async () => {
      await expect(autenticar(token(), false)).rejects.toThrow(DebeCambiarContrasenaError);
    });

    it('en las rutas de AUTH-D14 deja pasar', async () => {
      await expect(autenticar(token(), true)).resolves.toMatchObject({ sesionId: sesion.id });
    });

    it('una sesión inválida sigue siendo 401, no 403', async () => {
      await expect(autenticar('cualquier-cosa', false)).rejects.toThrow(SesionInvalidaError);
    });
  });

  describe('con @RequierePermiso()', () => {
    it('pasa si uno de sus roles activos tiene el permiso', async () => {
      const [rol] = await roles.rolesDeUsuario(usuario.id, ALFA.id);
      permisos.darPermiso(rol?.id ?? '', 'ventas.factura.ver');
      await expect(conPermiso('ventas.factura.ver')).resolves.toMatchObject({
        sesionId: sesion.id,
      });
    });

    it('sin el permiso responde 403', async () => {
      await expect(conPermiso('ventas.factura.ver')).rejects.toThrow(SinPermisoError);
      expect(new SinPermisoError().message).toBe('No tiene permiso para esta acción');
    });

    it('el permiso de un rol desactivado no cuenta (con otro rol activo, sigue con sesión)', async () => {
      const viejo = await roles.darRol(usuario.id, ALFA.id, { nombre: 'Viejo', activo: false });
      permisos.darPermiso(viejo.id, 'ventas.factura.ver');
      await expect(conPermiso('ventas.factura.ver')).rejects.toThrow(SinPermisoError);
    });

    it('el Administrador pasa sin filas de permisos (AUTH-D10)', async () => {
      await roles.darRol(usuario.id, ALFA.id, { nombre: 'Administrador', esAdministrador: true });
      await expect(conPermiso('ventas.factura.ver')).resolves.toMatchObject({
        esAdministrador: true,
      });
    });

    it('primero la sesión (401) y la contraseña temporal (403 de AUTH-D14), después el permiso', async () => {
      await expect(autenticar(null, false, 'ventas.factura.ver')).rejects.toThrow(
        SesionInvalidaError,
      );
      await usuarios.guardar(usuario.cambiarContrasena('hash', true));
      await expect(conPermiso('ventas.factura.ver')).rejects.toThrow(DebeCambiarContrasenaError);
    });
  });
});
