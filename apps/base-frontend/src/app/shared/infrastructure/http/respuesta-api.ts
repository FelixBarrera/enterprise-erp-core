/** Forma única de toda respuesta de la API (regla 3), la misma que arma el backend. */
export interface RespuestaApi<T> {
  success: boolean;
  data: T;
  message: string;
}
