/**
 * El refresh token es opaco y tiene la forma `<sid>.<secreto>.<firma>` (AUTH-D6): con el `sid` se
 * encuentra la sesión de cualquier token, aunque sea viejo, y así todo reuso se detecta. Del
 * secreto (256 bits en base64url: 43 caracteres) en la base queda solo su SHA-256.
 *
 * La firma (un HMAC-SHA256 del servidor sobre `<sid>.<secreto>`, también 43 caracteres) prueba
 * que el token lo entregó el servidor (SEG-05): el `sid` se ve en la ficha de un usuario y en la
 * bitácora, y sin la firma cualquiera armaría un token con un secreto inventado que, por la
 * detección de reuso, cerraría todas las sesiones de esa persona.
 */
export interface PartesTokenRefresco {
  readonly sesionId: string;
  readonly secreto: string;
}

export interface TokenRefrescoSeparado extends PartesTokenRefresco {
  readonly firma: string;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const BASE64URL_256 = '[A-Za-z0-9_-]{43}';
const FORMATO = new RegExp(`^(${UUID})\\.(${BASE64URL_256})\\.(${BASE64URL_256})$`);

/** Lo que se firma: el `sid` y el secreto, tal como van en el token. */
export function contenidoAFirmar(partes: PartesTokenRefresco): string {
  return `${partes.sesionId}.${partes.secreto}`;
}

/** Arma el token que va en la cookie. */
export function armarTokenRefresco(partes: PartesTokenRefresco, firma: string): string {
  return `${contenidoAFirmar(partes)}.${firma}`;
}

/**
 * Separa el token; `null` si no tiene la forma esperada (se trata como sesión inválida). **No
 * revisa la firma**: eso lo hace `GeneradorTokensPort.abrirRefresco()`.
 */
export function separarTokenRefresco(token: string): TokenRefrescoSeparado | null {
  const partes = FORMATO.exec(token);
  if (partes === null) {
    return null;
  }
  const [, sesionId = '', secreto = '', firma = ''] = partes;
  return { sesionId, secreto, firma };
}
