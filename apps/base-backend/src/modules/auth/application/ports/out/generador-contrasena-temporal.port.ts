export const GENERADOR_CONTRASENA_TEMPORAL_PORT = Symbol('GENERADOR_CONTRASENA_TEMPORAL_PORT');

/**
 * Contraseñas temporales al azar (AUTH-D13): 12 caracteres legibles, con un azar seguro para
 * criptografía. Cada llamada da otra.
 */
export interface GeneradorContrasenaTemporalPort {
  generar(): string;
}
