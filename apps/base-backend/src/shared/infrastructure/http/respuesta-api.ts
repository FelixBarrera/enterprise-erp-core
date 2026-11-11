/** Forma única de toda respuesta de la API (regla 3): éxito y error. */
export interface RespuestaApi<T> {
  success: boolean;
  data: T;
  message: string;
}

/** Respuesta de éxito. Los controllers responden siempre con `ok()`, nunca arman `{ success… }`. */
export function ok<T>(data: T, message: string): RespuestaApi<T> {
  return { success: true, data, message };
}

/** Respuesta de error: solo la usa el filtro global de errores. */
export function respuestaError(message: string): RespuestaApi<null> {
  return { success: false, data: null, message };
}
