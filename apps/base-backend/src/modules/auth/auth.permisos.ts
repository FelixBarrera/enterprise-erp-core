/**
 * Permisos del módulo `auth` (docs/modulos/auth-usuarios.md, sección 6). Los usan los endpoints de
 * usuarios y roles (6.7). Se juntan en `src/catalogo-permisos.ts` y se copian a la base al arrancar.
 */
export const PERMISOS_AUTH = {
  'auth.usuario.ver': 'Ver usuarios',
  'auth.usuario.crear': 'Crear usuarios',
  'auth.usuario.editar': 'Editar el nombre de los usuarios',
  'auth.usuario.asignar_roles': 'Asignar y quitar roles',
  'auth.usuario.restablecer': 'Dar contraseña temporal, desbloquear y cerrar sesiones',
  'auth.usuario.desactivar': 'Desactivar y reactivar usuarios',
  'auth.rol.ver': 'Ver roles',
  'auth.rol.crear': 'Crear roles',
  'auth.rol.editar': 'Editar roles y sus permisos',
  'auth.rol.desactivar': 'Desactivar y reactivar roles',
} as const;
