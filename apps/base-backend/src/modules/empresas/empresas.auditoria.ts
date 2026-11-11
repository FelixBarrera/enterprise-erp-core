import type { DeclaracionAuditoria } from '../auditoria/domain/catalogo-auditoria.js';

/**
 * Lo que registra el módulo `empresas` en la bitácora. Se junta en `src/catalogo-auditoria.ts`; una
 * acción o un campo nuevo se agrega aquí y en los textos del frontend (AUD-D9).
 */
export const AUDITORIA_EMPRESAS: DeclaracionAuditoria = {
  modulo: 'empresas',
  acciones: ['empresas.empresa.crear', 'empresas.empresa.editar', 'empresas.empresa.desactivar'],
  campos: ['nombre', 'activo'],
};
