import { actorDelSistema } from '../../../../../../shared/application/actor.js';
import type { AccesosUsuariosPort } from '../../../../application/ports/in/accesos-usuarios.port.js';
import type { AccionesUsuariosPort } from '../../../../application/ports/in/acciones-usuarios.port.js';
import type { AdministrarUsuariosPort } from '../../../../application/ports/in/administrar-usuarios.port.js';
import type {
  ConsultarUsuariosPort,
  UsuarioVista,
} from '../../../../application/ports/in/consultar-usuarios.port.js';
import { ListarUsuariosQueryDto } from './dtos/listar-usuarios-query.dto.js';
import { UsuariosController } from './usuarios.controller.js';

describe('UsuariosController', () => {
  const actor = actorDelSistema({ empresaId: 'e1' });
  const usuario: UsuarioVista = {
    id: 'u1',
    nombreUsuario: 'ana',
    nombreCompleto: 'Ana',
    activo: true,
    bloqueadoHasta: null,
    ultimoIngresoEn: null,
    roles: [],
    debeCambiarContrasena: false,
    trabajaEnOtrasEmpresas: false,
    sesiones: [],
    creado: null,
    modificado: null,
  };
  const pagina = { elementos: [], total: 0, pagina: 2, tamano: 5 };
  const consultar = {
    listar: vi.fn<ConsultarUsuariosPort['listar']>(() => Promise.resolve(pagina)),
    ver: vi.fn<ConsultarUsuariosPort['ver']>(() => Promise.resolve(usuario)),
    rolesAsignables: vi.fn<ConsultarUsuariosPort['rolesAsignables']>(() =>
      Promise.resolve([
        { id: 'r1', nombre: 'Caja', descripcion: null, esAdministrador: false, sePuedeDar: true },
      ]),
    ),
  };
  const administrar = {
    editar: vi.fn<AdministrarUsuariosPort['editar']>(() => Promise.resolve(usuario)),
  };
  const accesos = {
    crear: vi.fn<AccesosUsuariosPort['crear']>(() =>
      Promise.resolve({ usuario, contrasenaTemporal: 'k7Rm3xTq9vWb' }),
    ),
    fijarRoles: vi.fn<AccesosUsuariosPort['fijarRoles']>(() => Promise.resolve(usuario)),
    quitarAcceso: vi.fn<AccesosUsuariosPort['quitarAcceso']>(() =>
      Promise.resolve({ id: 'u1', sesionesCerradas: 2 }),
    ),
  };
  const acciones = {
    darContrasenaTemporal: vi.fn<AccionesUsuariosPort['darContrasenaTemporal']>(() =>
      Promise.resolve({ usuario, contrasenaTemporal: 'k7Rm3xTq9vWb' }),
    ),
    desbloquear: vi.fn<AccionesUsuariosPort['desbloquear']>(() => Promise.resolve(usuario)),
    cerrarSesiones: vi.fn<AccionesUsuariosPort['cerrarSesiones']>(() =>
      Promise.resolve({ id: 'u1', sesionesCerradas: 3 }),
    ),
    desactivar: vi.fn<AccionesUsuariosPort['desactivar']>(() => Promise.resolve(usuario)),
    reactivar: vi.fn<AccionesUsuariosPort['reactivar']>(() => Promise.resolve(usuario)),
  };
  const controller = new UsuariosController(consultar, administrar, accesos, acciones);
  const respuesta = (message: string, data: unknown = usuario) => ({
    success: true,
    data,
    message,
  });

  it('listar: pasa los filtros y la página, sin mezclarlos', async () => {
    const query = Object.assign(new ListarUsuariosQueryDto(), {
      pagina: 2,
      tamano: 5,
      texto: 'ana',
      activo: false,
      rolId: 'r1',
    });
    expect(await controller.listar(query, actor)).toEqual(respuesta('Usuarios', pagina));
    expect(consultar.listar).toHaveBeenCalledWith(
      { texto: 'ana', activo: false, rolId: 'r1' },
      { pagina: 2, tamano: 5 },
      actor,
    );
  });

  it('roles asignables: los de quien consulta', async () => {
    expect(await controller.rolesAsignables(actor)).toEqual(
      respuesta('Roles que se pueden dar', [
        { id: 'r1', nombre: 'Caja', descripcion: null, esAdministrador: false, sePuedeDar: true },
      ]),
    );
    expect(consultar.rolesAsignables).toHaveBeenCalledWith(actor);
  });

  it('ver y editar: pasan solo lo del DTO', async () => {
    expect(await controller.ver('u1', actor)).toEqual(respuesta('Datos del usuario'));
    expect(consultar.ver).toHaveBeenCalledWith('u1', actor);
    const dto = Object.assign({ nombreCompleto: 'Ana Pérez' }, { otro: 'x' });
    expect(await controller.editar('u1', dto, actor)).toEqual(respuesta('Usuario actualizado'));
    expect(administrar.editar).toHaveBeenCalledWith('u1', { nombreCompleto: 'Ana Pérez' }, actor);
  });

  it('crear, fijar roles y quitar acceso: pasan solo lo del DTO', async () => {
    const crear = Object.assign(
      { nombreUsuario: 'ana', nombreCompleto: 'Ana', roles: ['r1'] },
      { otro: 'x' },
    );
    expect(await controller.crear(crear, actor)).toEqual(
      respuesta('Usuario creado', { usuario, contrasenaTemporal: 'k7Rm3xTq9vWb' }),
    );
    expect(accesos.crear).toHaveBeenCalledWith(
      { nombreUsuario: 'ana', nombreCompleto: 'Ana', roles: ['r1'] },
      actor,
    );
    expect(await controller.fijarRoles('u1', { roles: ['r1', 'r2'] }, actor)).toEqual(
      respuesta('Roles actualizados'),
    );
    expect(accesos.fijarRoles).toHaveBeenCalledWith('u1', ['r1', 'r2'], actor);
    expect(await controller.quitarAcceso('u1', actor)).toEqual(
      respuesta('Acceso quitado', { id: 'u1', sesionesCerradas: 2 }),
    );
    expect(accesos.quitarAcceso).toHaveBeenCalledWith('u1', actor);
  });

  it('las acciones sobre la persona: pasan el id, y cerrar sesiones también la sesión actual', async () => {
    expect(await controller.darContrasenaTemporal('u1', actor)).toEqual(
      respuesta('Contraseña temporal generada', { usuario, contrasenaTemporal: 'k7Rm3xTq9vWb' }),
    );
    expect(acciones.darContrasenaTemporal).toHaveBeenCalledWith('u1', actor);
    expect(await controller.desbloquear('u1', actor)).toEqual(respuesta('Usuario desbloqueado'));
    expect(acciones.desbloquear).toHaveBeenCalledWith('u1', actor);
    const sesion = {
      actor: { ...actor, usuarioId: 'yo', empresaId: 'e1' },
      sesionId: 's1',
      esAdministrador: false,
    };
    expect(await controller.cerrarSesiones('u1', sesion)).toEqual(
      respuesta('Sesiones cerradas', { id: 'u1', sesionesCerradas: 3 }),
    );
    expect(acciones.cerrarSesiones).toHaveBeenCalledWith('u1', 's1', sesion.actor);
    expect(await controller.desactivar('u1', actor)).toEqual(respuesta('Usuario desactivado'));
    expect(acciones.desactivar).toHaveBeenCalledWith('u1', actor);
    expect(await controller.reactivar('u1', actor)).toEqual(respuesta('Usuario reactivado'));
    expect(acciones.reactivar).toHaveBeenCalledWith('u1', actor);
  });
});
