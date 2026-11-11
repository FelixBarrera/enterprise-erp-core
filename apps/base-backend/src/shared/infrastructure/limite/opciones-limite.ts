/** Cuántas peticiones por minuto se aceptan (AUTH-D17). Salen del `.env`; los e2e las cambian. */
export const OPCIONES_LIMITE = Symbol('OPCIONES_LIMITE');

/** El almacenamiento del contador (`AlmacenLimiteRedis`; en pruebas, uno en memoria). */
export const ALMACEN_LIMITE = Symbol('ALMACEN_LIMITE');

export interface OpcionesLimite {
  /** Intentos de login por IP (`LIMITE_LOGIN_POR_MINUTO`, 10). */
  readonly loginPorMinuto: number;
  /** Peticiones de un usuario con sesión, sume las de todos sus equipos (`LIMITE_USUARIO_POR_MINUTO`, 300). */
  readonly usuarioPorMinuto: number;
  /** Peticiones sin sesión (login, refresh) por IP (`LIMITE_IP_POR_MINUTO`, 60). */
  readonly ipPorMinuto: number;
}
