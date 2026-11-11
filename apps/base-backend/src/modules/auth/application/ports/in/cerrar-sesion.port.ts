import type { Actor } from '../../../../../shared/application/actor.js';

export const CERRAR_SESION_PORT = Symbol('CERRAR_SESION_PORT');

/**
 * `POST /auth/logout`: cierra **esta** sesión (motivo `SALIDA`) y lo registra
 * (`auth.sesion.cerrar`). Las otras sesiones del usuario siguen abiertas.
 */
export interface CerrarSesionPort {
  execute(sesionId: string, actor: Actor): Promise<void>;
}
