import type { Huella } from '../../../../auditoria/application/ports/in/consultar-trazabilidad.port.js';
import type { Actor } from '../../../../../shared/application/actor.js';
import type { Pagina, PedidoPagina } from '../../../../../shared/application/pagina.js';
import type { FiltrosRoles } from '../out/roles.repository.port.js';

export const CONSULTAR_ROLES_PORT = Symbol('CONSULTAR_ROLES_PORT');

/** Una fila de la lista de roles. */
export interface RolResumenVista {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly esAdministrador: boolean;
  readonly activo: boolean;
  /** Cuántos permisos vigentes da (el Administrador, todos los del catálogo). */
  readonly cantidadPermisos: number;
  /** Cuántos usuarios activos lo tienen. */
  readonly cantidadUsuarios: number;
}

/** La ficha de un rol. */
export interface RolVista {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly esAdministrador: boolean;
  readonly activo: boolean;
  /** Sus permisos vigentes, por código (el Administrador, todos los del catálogo). */
  readonly permisos: readonly string[];
  readonly cantidadUsuarios: number;
  /** Cuándo se creó y quién (de la bitácora de la empresa); `null` si no consta. */
  readonly creado: Huella | null;
  /** Su último cambio después de crearlo (datos, permisos, activo); `null` si no hubo. */
  readonly modificado: Huella | null;
}

/** `GET /roles` y `GET /roles/:id`: siempre los de la empresa activa de quien consulta. */
export interface ConsultarRolesPort {
  listar(
    filtros: FiltrosRoles,
    pedido: PedidoPagina,
    actor: Actor,
  ): Promise<Pagina<RolResumenVista>>;
  /** `RolNoEncontradoError` si no existe en la empresa activa. */
  ver(id: string, actor: Actor): Promise<RolVista>;
}
