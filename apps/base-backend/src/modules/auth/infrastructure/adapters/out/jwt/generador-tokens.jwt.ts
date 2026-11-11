import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  RELOJ_PORT,
  type RelojPort,
} from '../../../../../../shared/application/ports/reloj.port.js';
import type {
  DatosTokenAcceso,
  GeneradorTokensPort,
  TokenAcceso,
} from '../../../../application/ports/out/generador-tokens.port.js';
import {
  armarTokenRefresco,
  contenidoAFirmar,
  type PartesTokenRefresco,
  separarTokenRefresco,
} from '../../../../domain/value-objects/token-refresco.js';

/** Vida del access token (docs/arquitectura-backend.md, sección 14). */
export const SEGUNDOS_TOKEN_ACCESO = 15 * 60;

/** HS256 y nada más: así nadie puede mandar un token con `alg: none` ni con otro algoritmo. */
export const ALGORITMO_JWT = 'HS256';

/** La clave con la que se firma el refresh token (SEG-05); la arma `AuthModule`. */
export const CLAVE_FIRMA_REFRESCO = Symbol('CLAVE_FIRMA_REFRESCO');

/**
 * La clave del refresh token sale de `JWT_SECRETO` con HKDF-SHA256: es otra clave (firmar uno no
 * sirve para el otro) y no hace falta otra variable en el `.env`. Cambiar `JWT_SECRETO` invalida
 * a la vez los access tokens y las cookies: todos vuelven a ingresar.
 */
export function derivarClaveRefresco(jwtSecreto: string): Buffer {
  return Buffer.from(hkdfSync('sha256', jwtSecreto, '', 'firma-token-refresco', 32));
}

interface CargaJwt {
  sub?: unknown;
  sid?: unknown;
}

/**
 * Tokens con `@nestjs/jwt` (la firma con `JWT_SECRETO`, configurada en `AuthModule`) y
 * `node:crypto` (el secreto, su huella y la firma HMAC-SHA256 del refresh token). La hora sale de `RELOJ_PORT` (la emisión `iat` y la revisión del vencimiento),
 * no del reloj del sistema: así las pruebas la fijan.
 */
@Injectable()
export class GeneradorTokensJwt implements GeneradorTokensPort {
  constructor(
    private readonly jwt: JwtService,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
    @Inject(CLAVE_FIRMA_REFRESCO) private readonly claveRefresco: Buffer,
  ) {}

  async firmarAcceso(datos: DatosTokenAcceso): Promise<TokenAcceso> {
    const token = await this.jwt.signAsync(
      { sub: datos.usuarioId, sid: datos.sesionId, iat: this.segundosAhora() },
      { algorithm: ALGORITMO_JWT, expiresIn: SEGUNDOS_TOKEN_ACCESO },
    );
    return { token, expiraEnSegundos: SEGUNDOS_TOKEN_ACCESO };
  }

  async verificarAcceso(token: string): Promise<DatosTokenAcceso | null> {
    let carga: CargaJwt;
    try {
      carga = await this.jwt.verifyAsync<CargaJwt>(token, {
        algorithms: [ALGORITMO_JWT],
        clockTimestamp: this.segundosAhora(),
      });
    } catch {
      // Firma mala, vencido o mal formado: no vale (nunca un 500).
      return null;
    }
    const { sub, sid } = carga;
    if (typeof sub !== 'string' || typeof sid !== 'string') {
      return null;
    }
    return { usuarioId: sub, sesionId: sid };
  }

  nuevoSecreto(): string {
    return randomBytes(32).toString('base64url');
  }

  huella(secreto: string): string {
    return createHash('sha256').update(secreto, 'utf8').digest('hex');
  }

  armarRefresco(partes: PartesTokenRefresco): string {
    return armarTokenRefresco(partes, this.firmar(partes));
  }

  abrirRefresco(token: string): PartesTokenRefresco | null {
    const separado = separarTokenRefresco(token);
    if (separado === null) {
      return null;
    }
    const { sesionId, secreto, firma } = separado;
    const esperada = Buffer.from(this.firmar({ sesionId, secreto }), 'utf8');
    const recibida = Buffer.from(firma, 'utf8');
    // Las dos miden 43 (lo revisó el formato); la comparación tarda lo mismo acierte o no.
    if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
      return null;
    }
    return { sesionId, secreto };
  }

  private firmar(partes: PartesTokenRefresco): string {
    return createHmac('sha256', this.claveRefresco)
      .update(contenidoAFirmar(partes), 'utf8')
      .digest('base64url');
  }

  private segundosAhora(): number {
    return Math.floor(this.reloj.ahora().getTime() / 1000);
  }
}
