export const UNIDAD_DE_TRABAJO_PORT = Symbol('UNIDAD_DE_TRABAJO_PORT');

/** Opciones de una transacción. Sin opciones, vale lo de siempre (5 s como máximo). */
export interface OpcionesTransaccion {
  /**
   * Tiempo máximo de la transacción, en milisegundos. Si se pasa, se deshace todo y falla.
   * Solo para procesos largos (una importación), con una constante en su caso de uso.
   */
  tiempoMaximoMs?: number;
}

/**
 * Agrupa varias escrituras en una sola transacción: o se guardan todas o ninguna.
 *
 * - Lo que hacen los repositorios dentro de `fn` entra en la transacción solo (no se pasa nada
 *   como parámetro).
 * - Si `fn` lanza un error, se deshace todo y el error sigue su camino.
 * - Un `ejecutar()` dentro de otro se une al de afuera: se confirma o se deshace con él.
 * - Nada de llamadas de red dentro (SRI, correo): se guarda, se confirma y después se encola.
 *
 * En pruebas unitarias: `{ ejecutar: (fn) => fn() }`.
 */
export interface UnidadDeTrabajoPort {
  ejecutar<T>(fn: () => Promise<T>, opciones?: OpcionesTransaccion): Promise<T>;
}
