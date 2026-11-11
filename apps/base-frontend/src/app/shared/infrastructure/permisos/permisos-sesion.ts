import { InjectionToken } from '@angular/core';

/**
 * Lo que puede hacer la persona en la empresa activa, para las rutas, el menú y los botones. Lo
 * entrega el módulo `auth` desde `app.config.ts` (shared/ no conoce los módulos). **Por permiso,
 * nunca por rol; ocultar no es proteger**: el backend responde 403 igual.
 */
export interface PermisosSesion {
  /**
   * `true` si tiene el permiso `modulo.recurso.accion` (el Administrador, todos). Lee la sesión, que
   * es un signal: dentro de un `computed` o una plantilla, se actualiza solo cuando cambian los
   * permisos (llegan de nuevo con cada refresh). Sin sesión, `false`.
   */
  tiene(codigo: string): boolean;
  /**
   * `true` si hay una sesión lista para trabajar en esta pestaña o se recupera con la cookie (al
   * recargar la página, el token todavía no está). `false` sin sesión o con una contraseña temporal:
   * de eso se encarga el guard de sesión del layout. Sin conexión, lanza (ya avisado).
   */
  sesionLista(): Promise<boolean>;
}

export const PERMISOS_SESION = new InjectionToken<PermisosSesion>('PERMISOS_SESION');
