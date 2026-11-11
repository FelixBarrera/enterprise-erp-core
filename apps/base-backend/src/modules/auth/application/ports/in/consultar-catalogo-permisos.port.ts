export const CONSULTAR_CATALOGO_PERMISOS_PORT = Symbol('CONSULTAR_CATALOGO_PERMISOS_PORT');

export interface PermisoVista {
  /** `modulo.recurso.accion`: lo que se manda al fijar los permisos de un rol. */
  readonly codigo: string;
  readonly descripcion: string;
}

export interface GrupoPermisosVista {
  readonly modulo: string;
  /** El título del grupo en la pantalla («Usuarios y roles»). */
  readonly nombre: string;
  readonly permisos: readonly PermisoVista[];
}

/**
 * El catálogo vigente, por módulo, para armar un rol (`GET /permisos`). Es el mismo para todas
 * las empresas: el catálogo es del código, no de una empresa.
 */
export interface ConsultarCatalogoPermisosPort {
  execute(): GrupoPermisosVista[];
}
