import { InjectionToken } from '@angular/core';
import type { CambioContrasena, Sesion } from '../../../domain/sesion';

export interface CambiarContrasenaPort {
  /**
   * Cambia la contraseña de quien está en `sesion` y devuelve esa sesión ya sin contraseña
   * temporal. Lanza el `ErrorHttp` del backend (actual incorrecta, nueva débil, cuenta bloqueada,
   * sin conexión): la pantalla lo muestra.
   */
  execute(cambio: CambioContrasena, sesion: Sesion): Promise<Sesion>;
}

export const CAMBIAR_CONTRASENA_PORT = new InjectionToken<CambiarContrasenaPort>(
  'CAMBIAR_CONTRASENA_PORT',
);
