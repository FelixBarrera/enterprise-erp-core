import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { NotificacionesService } from '../avisos/notificaciones.service';
import { PERMISOS_SESION } from './permisos-sesion';

export const MENSAJE_SIN_PERMISO_PANTALLA = 'No tiene permiso para ver esta pantalla';

/**
 * Una pantalla solo con su permiso: `canMatch: [permisoGuard('auth.usuario.ver')]` en su ruta.
 * Sin él, avisa y lleva al inicio **sin descargar la pantalla** (por eso `canMatch` y no
 * `canActivate`, que corre después de descargarla).
 *
 * `canMatch` corre antes que el guard de sesión del layout: al recargar la página, la sesión se
 * recupera aquí. Sin sesión, con una contraseña temporal o sin conexión, deja seguir y el guard de
 * sesión lleva al login o a cambiar la contraseña (con la pantalla para volver).
 */
export function permisoGuard(codigo: string): CanMatchFn {
  return async () => {
    const permisos = inject(PERMISOS_SESION);
    const router = inject(Router);
    const avisos = inject(NotificacionesService);
    try {
      if (!(await permisos.sesionLista())) return true;
    } catch {
      return true;
    }
    if (permisos.tiene(codigo)) return true;
    // No se espera al «Aceptar»: el aviso queda a la vista sobre el inicio.
    void avisos.error(MENSAJE_SIN_PERMISO_PANTALLA);
    return router.parseUrl('/');
  };
}
