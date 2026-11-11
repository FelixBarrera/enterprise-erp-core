/**
 * Mensajes del acceso a la API. Los usan los errores del módulo `auth` y la documentación de
 * Swagger que agregan `@SoloSesion()` y `@RequierePermiso()` (así el texto es uno solo).
 */
export const MENSAJE_SESION_TERMINO = 'Su sesión terminó. Vuelva a ingresar.';

/** AUTH-D14: con una contraseña temporal, solo se puede cambiarla (y ver la sesión o salir). */
export const MENSAJE_DEBE_CAMBIAR_CONTRASENA = 'Debe cambiar su contraseña antes de continuar';

/** La ruta pide un permiso que no tiene en la empresa activa (`@RequierePermiso()`). */
export const MENSAJE_SIN_PERMISO = 'No tiene permiso para esta acción';
