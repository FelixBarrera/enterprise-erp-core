import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTAR_TRAZABILIDAD_PORT,
  type ConsultarTrazabilidadPort,
} from '../../../auditoria/application/ports/in/consultar-trazabilidad.port.js';
import type { Actor } from '../../../../shared/application/actor.js';
import {
  crearPagina,
  type Pagina,
  type PedidoPagina,
} from '../../../../shared/application/pagina.js';
import { RolNoEncontradoError } from '../../domain/errors/auth.errors.js';
import type {
  ConsultarRolesPort,
  RolResumenVista,
  RolVista,
} from '../ports/in/consultar-roles.port.js';
import {
  PERMISOS_REPOSITORY_PORT,
  type PermisosRepositoryPort,
} from '../ports/out/permisos.repository.port.js';
import {
  type FiltrosRoles,
  ROLES_REPOSITORY_PORT,
  type RolesRepositoryPort,
} from '../ports/out/roles.repository.port.js';
import { empresaDe, vistaDeRol } from './roles-comun.js';

/** La lista y la ficha de los roles de la empresa activa (`auth.rol.ver`). */
@Injectable()
export class ConsultarRolesUseCase implements ConsultarRolesPort {
  constructor(
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(PERMISOS_REPOSITORY_PORT) private readonly permisos: PermisosRepositoryPort,
    @Inject(CONSULTAR_TRAZABILIDAD_PORT) private readonly trazabilidad: ConsultarTrazabilidadPort,
  ) {}

  async listar(
    filtros: FiltrosRoles,
    pedido: PedidoPagina,
    actor: Actor,
  ): Promise<Pagina<RolResumenVista>> {
    const { elementos, total } = await this.roles.listar(empresaDe(actor), filtros, pedido);
    // El Administrador no tiene filas en roles_permisos: tiene todos (AUTH-D10).
    const todos = elementos.some((rol) => rol.esAdministrador)
      ? (await this.permisos.codigosVigentes()).length
      : 0;
    const vistas = elementos.map((rol): RolResumenVista => ({
      id: rol.id,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      esAdministrador: rol.esAdministrador,
      activo: rol.activo,
      cantidadPermisos: rol.esAdministrador ? todos : rol.cantidadPermisos,
      cantidadUsuarios: rol.cantidadUsuarios,
    }));
    return crearPagina(vistas, total, pedido);
  }

  async ver(id: string, actor: Actor): Promise<RolVista> {
    const rol = await this.roles.buscarPorId(id, empresaDe(actor));
    if (rol === null) {
      throw new RolNoEncontradoError();
    }
    return vistaDeRol(rol, {
      roles: this.roles,
      permisos: this.permisos,
      trazabilidad: this.trazabilidad,
    });
  }
}
