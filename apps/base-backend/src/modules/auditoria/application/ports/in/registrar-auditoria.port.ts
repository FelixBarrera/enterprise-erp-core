import type { Actor } from '../../../../../shared/application/actor.js';
import type { DatosEvento } from '../../../domain/evento-auditoria.js';

export const REGISTRAR_AUDITORIA_PORT = Symbol('REGISTRAR_AUDITORIA_PORT');

/** Lo que manda un módulo para registrar un evento. */
export type DatosEventoAuditoria = DatosEvento;

/**
 * La bitácora (regla 14). Lo usan todos los módulos que escriben, **dentro** de la misma
 * `UNIDAD_DE_TRABAJO_PORT.ejecutar()` del cambio: si el cambio se deshace, el evento también.
 *
 * ```ts
 * await this.auditoria.registrar(
 *   { accion: 'auth.usuario.editar', entidad: 'usuario', entidadId: id, antes, despues },
 *   actor,
 * );
 * ```
 *
 * - `antes` y `despues` en camelCase; se guarda solo lo que cambió. Si nada cambió, no escribe.
 * - Contraseñas, hashes, tokens y secretos nunca entran con su valor (quedan `[OCULTO]`).
 * - La hora la pone `RELOJ_PORT`.
 * - Un evento que debe quedar aunque la operación falle (login fallido) se registra en su
 *   propia transacción, confirmada antes de lanzar el error.
 */
export interface RegistrarAuditoriaPort {
  registrar(evento: DatosEventoAuditoria, actor: Actor): Promise<void>;
}
