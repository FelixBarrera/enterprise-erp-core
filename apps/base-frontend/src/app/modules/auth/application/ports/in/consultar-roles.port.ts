import { InjectionToken } from '@angular/core';
import type { Pagina, PedidoPagina } from '../../../../../shared/domain/pagina';
import type { GrupoPermisos } from '../../../domain/permisos-rol';
import type { FiltrosRoles, Rol, RolResumen } from '../../../domain/rol';

export interface ConsultarRolesPort {
  /** Los roles de la empresa activa: el Administrador primero, luego por nombre. */
  listar(filtros: FiltrosRoles, pedido: PedidoPagina): Promise<Pagina<RolResumen>>;
  /** La ficha de un rol. */
  ver(id: string): Promise<Rol>;
  /** El catálogo de permisos, agrupado por módulo, para armar un rol. */
  catalogo(): Promise<GrupoPermisos[]>;
}

export const CONSULTAR_ROLES_PORT = new InjectionToken<ConsultarRolesPort>('CONSULTAR_ROLES_PORT');
