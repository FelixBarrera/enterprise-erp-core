import { actorDelSistema } from '../../../../../../shared/application/actor.js';
import type { AdministrarRolesPort } from '../../../../application/ports/in/administrar-roles.port.js';
import type {
  ConsultarRolesPort,
  RolVista,
} from '../../../../application/ports/in/consultar-roles.port.js';
import { ListarRolesQueryDto } from './dtos/listar-roles-query.dto.js';
import { RolesController } from './roles.controller.js';

describe('RolesController', () => {
  const actor = actorDelSistema({ empresaId: 'e1' });
  const rol: RolVista = {
    id: 'r1',
    nombre: 'Caja',
    descripcion: null,
    esAdministrador: false,
    activo: true,
    permisos: [],
    cantidadUsuarios: 0,
    creado: null,
    modificado: null,
  };
  const pagina = { elementos: [], total: 0, pagina: 2, tamano: 5 };
  const consultar = {
    listar: vi.fn<ConsultarRolesPort['listar']>(() => Promise.resolve(pagina)),
    ver: vi.fn<ConsultarRolesPort['ver']>(() => Promise.resolve(rol)),
  };
  const conRol = () => Promise.resolve(rol);
  const administrar = {
    crear: vi.fn<AdministrarRolesPort['crear']>(conRol),
    editar: vi.fn<AdministrarRolesPort['editar']>(conRol),
    fijarPermisos: vi.fn<AdministrarRolesPort['fijarPermisos']>(conRol),
    desactivar: vi.fn<AdministrarRolesPort['desactivar']>(conRol),
    reactivar: vi.fn<AdministrarRolesPort['reactivar']>(conRol),
  };
  const controller = new RolesController(consultar, administrar);
  const respuesta = (message: string, data: unknown = rol) => ({ success: true, data, message });

  it('listar: pasa los filtros y la página, sin mezclarlos', async () => {
    const query = Object.assign(new ListarRolesQueryDto(), {
      pagina: 2,
      tamano: 5,
      texto: 'caja',
      activo: true,
    });
    expect(await controller.listar(query, actor)).toEqual(respuesta('Roles', pagina));
    expect(consultar.listar).toHaveBeenCalledWith(
      { texto: 'caja', activo: true },
      { pagina: 2, tamano: 5 },
      actor,
    );
  });

  it('ver, crear y editar: pasan solo lo del DTO', async () => {
    expect(await controller.ver('r1', actor)).toEqual(respuesta('Datos del rol'));
    expect(consultar.ver).toHaveBeenCalledWith('r1', actor);
    expect(await controller.crear({ nombre: 'Caja', permisos: ['a.b.c'] }, actor)).toEqual(
      respuesta('Rol creado'),
    );
    expect(administrar.crear).toHaveBeenCalledWith(
      { nombre: 'Caja', descripcion: undefined, permisos: ['a.b.c'] },
      actor,
    );
    expect(await controller.editar('r1', { descripcion: null }, actor)).toEqual(
      respuesta('Rol actualizado'),
    );
    expect(administrar.editar).toHaveBeenCalledWith(
      'r1',
      { nombre: undefined, descripcion: null },
      actor,
    );
  });

  it('permisos, desactivar y reactivar', async () => {
    expect(await controller.fijarPermisos('r1', { permisos: ['a.b.c'] }, actor)).toEqual(
      respuesta('Permisos del rol actualizados'),
    );
    expect(administrar.fijarPermisos).toHaveBeenCalledWith('r1', ['a.b.c'], actor);
    expect(await controller.desactivar('r1', actor)).toEqual(respuesta('Rol desactivado'));
    expect(administrar.desactivar).toHaveBeenCalledWith('r1', actor);
    expect(await controller.reactivar('r1', actor)).toEqual(respuesta('Rol reactivado'));
    expect(administrar.reactivar).toHaveBeenCalledWith('r1', actor);
  });
});
