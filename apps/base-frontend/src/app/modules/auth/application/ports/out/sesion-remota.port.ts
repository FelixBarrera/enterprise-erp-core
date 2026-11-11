import { InjectionToken } from '@angular/core';
import type { CambioContrasena, Credenciales, Sesion, TokenAcceso } from '../../../domain/sesion';

/** La sesión en el backend (`/auth/…`). Los errores llegan como `ErrorHttp`. */
export interface SesionRemotaPort {
  /** `POST /auth/login`. Deja la cookie del refresh en el navegador. */
  iniciar(credenciales: Credenciales): Promise<TokenAcceso>;
  /** `POST /auth/refresh`. `null` si la sesión ya terminó (401); sin conexión, lanza el error. */
  renovar(): Promise<TokenAcceso | null>;
  /** `GET /auth/sesion` con ese token (todavía no está guardado en ningún lado). */
  consultar(token: TokenAcceso): Promise<Sesion>;
  /** `POST /auth/logout`: cierra la sesión de este navegador y borra la cookie. */
  cerrar(): Promise<void>;
  /**
   * `POST /auth/cambiar-contrasena` con el token de la sesión. Sus errores (también sin conexión y
   * la cuenta bloqueada) los muestra la pantalla, sin aviso global.
   */
  cambiarContrasena(cambio: CambioContrasena): Promise<void>;
  /**
   * `POST /auth/empresa` con el token de la sesión (sigue sirviendo): la sesión ya con la empresa
   * nueva. Sus errores (sin acceso a esa empresa, sin conexión) van con el aviso global.
   */
  cambiarEmpresa(empresaId: string): Promise<Sesion>;
}

export const SESION_REMOTA_PORT = new InjectionToken<SesionRemotaPort>('SESION_REMOTA_PORT');
