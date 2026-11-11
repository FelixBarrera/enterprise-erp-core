import {
  fijarZonaNegocio,
  ZONA_NEGOCIO_POR_DEFECTO,
} from '../../../../shared/domain/zona-negocio.js';
import type { Sesion } from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import { SesionInvalidaError } from '../../domain/errors/auth.errors.js';
import {
  ConsultarEmpresasDePrueba,
  idDePrueba,
  PermisosEnMemoria,
  RolesEnMemoria,
  SesionesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import { ConsultarSesionUseCase } from './consultar-sesion.use-case.js';

const ALFA = { id: idDePrueba(1), nombre: 'Alfa Comercial', activo: true };
const BETA = { id: idDePrueba(2), nombre: 'Beta Servicios', activo: true };
const GAMA = { id: idDePrueba(3), nombre: 'Gama (desactivada)', activo: false };

describe('ConsultarSesionUseCase', () => {
  let usuarios: UsuariosEnMemoria;
  let roles: RolesEnMemoria;
  let sesiones: SesionesEnMemoria;
  let permisos: PermisosEnMemoria;
  let casoDeUso: ConsultarSesionUseCase;
  let usuario: Usuario;
  let sesion: Sesion;

  beforeEach(async () => {
    usuarios = new UsuariosEnMemoria();
    roles = new RolesEnMemoria();
    sesiones = new SesionesEnMemoria();
    permisos = new PermisosEnMemoria(roles);
    casoDeUso = new ConsultarSesionUseCase(
      sesiones,
      usuarios,
      roles,
      new ConsultarEmpresasDePrueba([BETA, ALFA, GAMA]),
      permisos,
    );
    usuario = usuarios.agregar('ana', { nombreCompleto: 'Ana Pérez' });
    await roles.darRol(usuario.id, BETA.id);
    await roles.darRol(usuario.id, ALFA.id);
    await roles.darRol(usuario.id, GAMA.id);
    sesion = sesiones.agregar({ usuarioId: usuario.id, empresaId: BETA.id });
  });

  afterEach(() => {
    fijarZonaNegocio(ZONA_NEGOCIO_POR_DEFECTO);
  });

  const consultar = (empresaId = BETA.id, esAdministrador = true) =>
    casoDeUso.execute({
      sesionId: sesion.id,
      usuarioId: usuario.id,
      empresaId,
      esAdministrador,
    });

  it('arma la sesión: usuario, empresa activa, sus empresas activas por nombre, zona y vencimiento', async () => {
    fijarZonaNegocio('America/Mexico_City');

    await expect(consultar()).resolves.toEqual({
      usuario: {
        id: usuario.id,
        nombreUsuario: 'ana',
        nombreCompleto: 'Ana Pérez',
        debeCambiarContrasena: false,
      },
      empresaActiva: { id: BETA.id, nombre: 'Beta Servicios' },
      empresas: [
        { id: ALFA.id, nombre: 'Alfa Comercial' },
        { id: BETA.id, nombre: 'Beta Servicios' },
      ],
      esAdministrador: true,
      permisos: [],
      zonaNegocio: 'America/Mexico_City',
      sesionVenceEn: sesion.venceEn,
    });
  });

  it('el Administrador recibe todos los permisos vigentes, por código (AUTH-D10)', async () => {
    permisos.agregar('empresas.empresa.editar');
    permisos.agregar('auth.usuario.ver');
    permisos.agregar('auth.rol.borrar', 'Ya no existe', true);

    const vista = await consultar(BETA.id, true);

    expect(vista.permisos).toEqual(['auth.usuario.ver', 'empresas.empresa.editar']);
  });

  it('quien no es administrador recibe los de sus roles activos en la empresa activa, sin repetir', async () => {
    const [enBeta] = await roles.rolesDeUsuario(usuario.id, BETA.id);
    const [enAlfa] = await roles.rolesDeUsuario(usuario.id, ALFA.id);
    if (enBeta === undefined || enAlfa === undefined) {
      throw new Error('faltan los roles de la preparación');
    }
    const inactivo = await roles.darRol(usuario.id, BETA.id, { nombre: 'Viejo', activo: false });
    const otro = await roles.darRol(usuario.id, BETA.id, { nombre: 'Consulta' });
    permisos.darPermiso(enBeta.id, 'auth.usuario.ver');
    permisos.darPermiso(otro.id, 'auth.usuario.ver');
    permisos.darPermiso(otro.id, 'auditoria.evento.ver');
    permisos.darPermiso(inactivo.id, 'auth.rol.editar');
    permisos.darPermiso(enAlfa.id, 'empresas.empresa.editar');
    // Un permiso obsoleto que el rol todavía tiene: ya no cuenta.
    permisos.agregar('auth.rol.borrar', 'Ya no existe', true);
    permisos.darPermiso(otro.id, 'auth.rol.borrar');

    const vista = await consultar(BETA.id, false);

    expect(vista.permisos).toEqual(['auditoria.evento.ver', 'auth.usuario.ver']);
  });

  it('si la empresa activa dejó de estar entre las suyas en ese instante, 401', async () => {
    await expect(consultar(GAMA.id)).rejects.toThrow(SesionInvalidaError);
  });

  it('si la sesión ya no existe, 401', async () => {
    sesiones.filas.clear();
    await expect(consultar()).rejects.toThrow(SesionInvalidaError);
  });
});
