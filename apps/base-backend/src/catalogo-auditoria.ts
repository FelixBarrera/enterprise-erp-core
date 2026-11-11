import type { DeclaracionAuditoria } from './modules/auditoria/domain/catalogo-auditoria.js';
import { AUDITORIA_AUTH } from './modules/auth/auth.auditoria.js';
import { AUDITORIA_EMPRESAS } from './modules/empresas/empresas.auditoria.js';

/**
 * Todo lo que la API registra en la bitácora: acciones, campos de `antes`/`despues` y valores
 * fijos (como `src/catalogo-permisos.ts` junta los permisos). Módulo nuevo que registra: su
 * `<modulo>.auditoria.ts` y una línea aquí. El frontend copia esta lista para sus textos (AUD-D9).
 *
 * No se usa al registrar (la API funciona igual): lo revisan las pruebas.
 * - `catalogo-auditoria.spec.ts`: cada `accion: '…'` escrita en `src/modules` está aquí, y al revés.
 * - `AuditoriaEnMemoria` (la bitácora de las pruebas de los casos de uso) falla si recibe una
 *   acción, un campo o un valor fijo que no está.
 */
export const CATALOGO_AUDITORIA: readonly DeclaracionAuditoria[] = [
  AUDITORIA_AUTH,
  AUDITORIA_EMPRESAS,
];
