import { InjectionToken } from '@angular/core';
import type { Pagina, PedidoPagina } from '../../../../../shared/domain/pagina';
import type { GrupoPermisos } from '../../../domain/permisos-rol';
import type { CambiosRol, FiltrosRoles, NuevoRol, Rol, RolResumen } from '../../../domain/rol';

/** Los roles de la empresa activa en el backend (`/roles`). Los errores llegan como `ErrorHttp`. */
export interface RolesRemotosPort {
  /** `GET /roles`. */
  listar(filtros: FiltrosRoles, pedido: PedidoPagina): Promise<Pagina<RolResumen>>;
  /** `GET /roles/:id`. */
  ver(id: string): Promise<Rol>;
  /** `POST /roles`. */
  crear(nuevo: NuevoRol): Promise<Rol>;
  /** `PATCH /roles/:id` con solo lo que cambió. */
  editar(id: string, cambios: CambiosRol): Promise<Rol>;
  /** `PUT /roles/:id/permisos`: queda con exactamente estos. */
  fijarPermisos(id: string, permisos: readonly string[]): Promise<Rol>;
  /** `POST /roles/:id/desactivar`. */
  desactivar(id: string): Promise<Rol>;
  /** `POST /roles/:id/reactivar`. */
  reactivar(id: string): Promise<Rol>;
  /** `GET /permisos`. */
  catalogo(): Promise<GrupoPermisos[]>;
}

export const ROLES_REMOTOS_PORT = new InjectionToken<RolesRemotosPort>('ROLES_REMOTOS_PORT');
