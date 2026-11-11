export const OPCIONES_SESION = Symbol('OPCIONES_SESION');

/**
 * Cuánto dura una sesión (del `.env`: cambia de un negocio a otro). Los casos de uso no leen el
 * `.env`: el módulo lo entrega con este token.
 */
export interface OpcionesSesion {
  /** `SESION_DURACION_MAXIMA_HORAS` (13 por defecto): una jornada, aunque se use sin parar. */
  readonly duracionMaximaHoras: number;
  /** `SESION_INACTIVIDAD_MINUTOS` (120 por defecto): sin uso, se corta. */
  readonly inactividadMinutos: number;
}
