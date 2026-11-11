import { DomainError, TipoErrorDominio } from './domain-error.js';

/** Fecha que no existe o con un formato que no se entiende (→ 400). */
export class FechaInvalidaError extends DomainError {
  constructor(mensaje = 'La fecha no es válida') {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}

/** Monto o factor que no es un número decimal válido (→ 400). */
export class MontoInvalidoError extends DomainError {
  constructor(mensaje = 'El monto no es válido') {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}

/** Zona horaria que no existe o que no es un nombre de lugar (`America/Guayaquil`). */
export class ZonaHorariaInvalidaError extends DomainError {
  constructor(mensaje = 'La zona horaria no es válida: debe ser un nombre como America/Guayaquil') {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}
