import type { CookieOptions, Request, Response } from 'express';
import { PREFIJO_API } from '../../../../../../shared/infrastructure/http/prefijo-api.js';

/** Nombre de la cookie del refresh token. */
export const COOKIE_REFRESCO = 'token_refresco';

/**
 * Solo viaja a las rutas de la sesión (`/api/v1/auth`), nunca la lee JavaScript (`httpOnly`),
 * solo por HTTPS (`Secure`; los navegadores la aceptan también en `http://localhost`) y nunca
 * desde otro sitio (`SameSite=Strict`).
 */
export const OPCIONES_COOKIE_REFRESCO: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: `/${PREFIJO_API}/auth`,
};

/** Pone la cookie; vence a la misma hora que la sesión. */
export function ponerCookieRefresco(respuesta: Response, token: string, venceEn: Date): void {
  respuesta.cookie(COOKIE_REFRESCO, token, { ...OPCIONES_COOKIE_REFRESCO, expires: venceEn });
}

/** La borra del navegador (sesión terminada o inválida). */
export function borrarCookieRefresco(respuesta: Response): void {
  respuesta.clearCookie(COOKIE_REFRESCO, OPCIONES_COOKIE_REFRESCO);
}

/** El refresh token de la cookie; `null` si no vino. */
export function leerCookieRefresco(peticion: Request): string | null {
  const cookies: unknown = peticion.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return null;
  }
  const valor: unknown = (cookies as Record<string, unknown>)[COOKIE_REFRESCO];
  return typeof valor === 'string' && valor !== '' ? valor : null;
}
