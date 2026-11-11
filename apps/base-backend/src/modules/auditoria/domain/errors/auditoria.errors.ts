import { DomainError, TipoErrorDominio } from '../../../../shared/domain/errors/domain-error.js';

/**
 * Un evento mal armado por el código que lo registra (acción sin formato, entidad sin id).
 * No es un error del usuario: es de programación, sale como 500 y se corrige en el módulo
 * que lo mandó. Por eso no extiende `DomainError`.
 */
export class EventoAuditoriaInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Evento de auditoría inválido: ${motivo}`);
    this.name = 'EventoAuditoriaInvalidoError';
  }
}

/** Rango de la consulta al revés o de más de 92 días (AUD-D8) (→ 400). */
export class RangoFechasInvalidoError extends DomainError {
  constructor(mensaje: string) {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}

/** El evento no existe o es de otra empresa (AUD-D5): las dos dan lo mismo (→ 404). */
export class EventoNoEncontradoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.NO_ENCONTRADO, 'El evento no existe');
  }
}
