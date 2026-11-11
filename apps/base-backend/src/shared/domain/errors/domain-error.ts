/**
 * Tipos de error del negocio. El filtro global los traduce a HTTP
 * (docs/arquitectura-backend.md, sección 4); el dominio no sabe de HTTP.
 */
export const TipoErrorDominio = {
  VALIDACION: 'VALIDACION',
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  NO_AUTORIZADO: 'NO_AUTORIZADO',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  CONFLICTO: 'CONFLICTO',
  REGLA_NEGOCIO: 'REGLA_NEGOCIO',
} as const;
export type TipoErrorDominio = (typeof TipoErrorDominio)[keyof typeof TipoErrorDominio];

/**
 * Error que el usuario puede entender: su `message` (en español) llega tal cual a la pantalla.
 * Cada módulo define los suyos extendiendo esta clase, por ejemplo:
 * `class ClienteNoEncontradoError extends DomainError { constructor() { super(TipoErrorDominio.NO_ENCONTRADO, 'El cliente no existe'); } }`
 */
export class DomainError extends Error {
  constructor(
    readonly tipo: TipoErrorDominio,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
