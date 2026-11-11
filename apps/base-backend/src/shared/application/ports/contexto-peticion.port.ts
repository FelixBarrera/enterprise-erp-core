export const CONTEXTO_PETICION_PORT = Symbol('CONTEXTO_PETICION_PORT');

/**
 * Datos de la petición en curso, para los casos de uso (por ejemplo, para la auditoría).
 * Todo es `null` fuera de una petición (una tarea de una cola, un comando).
 */
export interface ContextoPeticionPort {
  /** El número de la petición (el mismo que sale en el log y en la cabecera `x-request-id`). */
  requestId(): string | null;
  /** La IP de quien llamó (la real si `TRUST_PROXY=true` detrás de Nginx). */
  ip(): string | null;
  /** El navegador o programa que llamó (cabecera `user-agent`). */
  navegador(): string | null;
}
