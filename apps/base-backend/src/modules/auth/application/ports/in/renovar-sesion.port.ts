import type { TokensSesion } from './iniciar-sesion.port.js';

export const RENOVAR_SESION_PORT = Symbol('RENOVAR_SESION_PORT');

/**
 * `POST /auth/refresh`: con el refresh token de la cookie, un access token nuevo y otro refresh
 * (rota en cada uso). Un token viejo (fuera de los 60 s de gracia) es un **reuso**: cierra todas
 * las sesiones del usuario y lo registra (AUTH-D7). Cualquier problema: `SesionInvalidaError`.
 */
export interface RenovarSesionPort {
  execute(tokenRefresco: string | null): Promise<TokensSesion>;
}
