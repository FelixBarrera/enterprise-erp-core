export const RELOJ_PORT = Symbol('RELOJ_PORT');

/**
 * La hora del sistema. Los casos de uso piden "ahora" aquí, nunca con `new Date()` ni
 * `Date.now()`: así las pruebas fijan la hora con `RelojFijo`.
 *
 * Devuelve un instante (el mismo en todo el mundo); la zona solo importa al sacar la fecha
 * del negocio (`FechaFiscal.desdeInstante(reloj.ahora())`) o al mostrarlo, y siempre es la
 * zona del negocio (`ZONA_NEGOCIO`, por defecto Guayaquil).
 */
export interface RelojPort {
  ahora(): Date;
}
