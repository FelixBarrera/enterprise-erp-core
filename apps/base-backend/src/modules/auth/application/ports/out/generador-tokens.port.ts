import type { PartesTokenRefresco } from '../../../domain/value-objects/token-refresco.js';

export const GENERADOR_TOKENS_PORT = Symbol('GENERADOR_TOKENS_PORT');

/** Lo que lleva el access token (AUTH-D5): solo el usuario (`sub`) y la sesión (`sid`). */
export interface DatosTokenAcceso {
  readonly usuarioId: string;
  readonly sesionId: string;
}

export interface TokenAcceso {
  readonly token: string;
  readonly expiraEnSegundos: number;
}

/**
 * Tokens de la sesión (docs/arquitectura-backend.md, sección 14): el access token (JWT HS256 de
 * 15 minutos, firmado con `JWT_SECRETO`) y el refresh token (`<sid>.<secreto>.<firma>`: un
 * secreto de 256 bits al azar, del que en la base queda solo su huella SHA-256, y la firma HMAC
 * del servidor, SEG-05).
 */
export interface GeneradorTokensPort {
  firmarAcceso(datos: DatosTokenAcceso): Promise<TokenAcceso>;
  /** `null` si la firma no es válida, si venció o si le falta `sub` o `sid` (lo usa el guard). */
  verificarAcceso(token: string): Promise<DatosTokenAcceso | null>;
  /** 256 bits al azar, en base64url (43 caracteres). */
  nuevoSecreto(): string;
  /** SHA-256 del secreto, en hexadecimal (64 caracteres): lo único que se guarda. */
  huella(secreto: string): string;
  /** El refresh token que va en la cookie, con la firma del servidor. */
  armarRefresco(partes: PartesTokenRefresco): string;
  /**
   * El `sid` y el secreto de un refresh token; `null` si no tiene la forma esperada o si la
   * firma no es del servidor (un token inventado: no se busca la sesión ni cuenta como reuso).
   */
  abrirRefresco(token: string): PartesTokenRefresco | null;
}
