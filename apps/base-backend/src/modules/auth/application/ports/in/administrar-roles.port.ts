import type { Actor } from '../../../../../shared/application/actor.js';
import type { RolVista } from './consultar-roles.port.js';

export const ADMINISTRAR_ROLES_PORT = Symbol('ADMINISTRAR_ROLES_PORT');

export interface CrearRolComando {
  readonly nombre: string;
  /** Sin el campo, `null` o vacío: sin descripción. */
  readonly descripcion?: string | null;
  /** Sus permisos desde el inicio (decisión del usuario, 6.7b); sin el campo, ninguno. */
  readonly permisos?: readonly string[];
}

/** Lo que se cambia; un campo que no viene queda igual. `descripcion: null` la quita. */
export interface EditarRolComando {
  readonly nombre?: string;
  readonly descripcion?: string | null;
}

/**
 * Crear y cambiar roles de la empresa activa. Todos revisan AUTH-D10 (el Administrador no se
 * cambia) y AUTH-D11 (nadie da permisos que no tiene), escriben y registran en la bitácora en la
 * misma transacción. Si nada cambia, no escriben ni registran. `RolNoEncontradoError` si el rol
 * no es de la empresa activa.
 */
export interface AdministrarRolesPort {
  /** `auth.rol.crear`. `NombreRolDuplicadoError` si ya hay uno activo con ese nombre. */
  crear(comando: CrearRolComando, actor: Actor): Promise<RolVista>;
  /** `auth.rol.editar`: nombre y descripción. */
  editar(id: string, comando: EditarRolComando, actor: Actor): Promise<RolVista>;
  /** `auth.rol.permisos`: deja al rol con exactamente esos permisos. */
  fijarPermisos(id: string, permisos: readonly string[], actor: Actor): Promise<RolVista>;
  /** `auth.rol.desactivar`: deja de dar permisos; sus asignaciones quedan. */
  desactivar(id: string, actor: Actor): Promise<RolVista>;
  /** `auth.rol.reactivar`: vuelve a dar sus permisos a quienes lo tienen. */
  reactivar(id: string, actor: Actor): Promise<RolVista>;
}
