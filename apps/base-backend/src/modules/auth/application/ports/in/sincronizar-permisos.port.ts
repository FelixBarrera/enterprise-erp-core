export const SINCRONIZAR_PERMISOS_PORT = Symbol('SINCRONIZAR_PERMISOS_PORT');

/** Lo que cambió en la base, por código (para el log del arranque). */
export interface ResumenSincronizacion {
  readonly creados: readonly string[];
  /** Con otra descripción, o que estaban obsoletos y el código volvió a declarar. */
  readonly actualizados: readonly string[];
  readonly obsoletos: readonly string[];
}

/**
 * Copia el catálogo del código a `seguridad.permisos` (crea, actualiza la descripción, marca
 * obsoleto el que salió; nunca borra). Lo corre el arranque; se puede correr las veces que sea.
 * `CatalogoPermisosInvalidoError` si un `<modulo>.permisos.ts` está mal: la API no arranca.
 */
export interface SincronizarPermisosPort {
  execute(): Promise<ResumenSincronizacion>;
}
