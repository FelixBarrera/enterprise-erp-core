import { DomainError, TipoErrorDominio } from '../../../../shared/domain/errors/domain-error.js';

/** Nombre vacío o demasiado largo (→ 400). */
export class NombreEmpresaInvalidoError extends DomainError {
  constructor(mensaje: string) {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}

/** No hay una empresa con ese id (→ 404). */
export class EmpresaNoEncontradaError extends DomainError {
  constructor() {
    super(TipoErrorDominio.NO_ENCONTRADO, 'La empresa no existe');
  }
}

/** La empresa existe pero está desactivada: nadie puede entrar ni trabajar en ella (→ 422). */
export class EmpresaInactivaError extends DomainError {
  constructor() {
    super(TipoErrorDominio.REGLA_NEGOCIO, 'La empresa está desactivada');
  }
}

/** Ya hay una empresa activa con ese nombre, sin importar mayúsculas ni tildes (→ 409). */
export class NombreEmpresaDuplicadoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.CONFLICTO, 'Ya existe una empresa con ese nombre');
  }
}
