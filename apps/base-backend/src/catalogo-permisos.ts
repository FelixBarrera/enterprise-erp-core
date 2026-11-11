import type { DeclaracionPermisos } from './modules/auth/application/ports/out/catalogo-permisos.port.js';
import { PERMISOS_AUDITORIA } from './modules/auditoria/auditoria.permisos.js';
import { PERMISOS_AUTH } from './modules/auth/auth.permisos.js';
import { PERMISOS_EMPRESAS } from './modules/empresas/empresas.permisos.js';

/**
 * Todos los permisos de la API, juntos (como `src/comandos/` junta los comandos). Módulo nuevo con
 * permisos: su `<modulo>.permisos.ts` y una línea aquí, con el nombre que ve quien arma un rol
 * (el título del grupo en `GET /permisos`; este orden es el de la pantalla). Al arrancar se copian a
 * `seguridad.permisos` (crea, actualiza la descripción, marca obsoleto el que salió, nunca borra).
 * Un módulo repetido o sin nombre, un código sin el formato `modulo.recurso.accion` o de otro módulo impide arrancar.
 */
export const CATALOGO_PERMISOS: readonly DeclaracionPermisos[] = [
  { modulo: 'auth', nombre: 'Usuarios y roles', permisos: PERMISOS_AUTH },
  { modulo: 'auditoria', nombre: 'Bitácora', permisos: PERMISOS_AUDITORIA },
  { modulo: 'empresas', nombre: 'Empresa', permisos: PERMISOS_EMPRESAS },
];
