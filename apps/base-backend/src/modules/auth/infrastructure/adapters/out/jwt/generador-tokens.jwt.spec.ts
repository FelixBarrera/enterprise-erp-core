import { JwtService } from '@nestjs/jwt';
import { RelojFijo } from '../../../../../../shared/application/testing/reloj-fijo.js';
import { createHmac } from 'node:crypto';
import {
  derivarClaveRefresco,
  GeneradorTokensJwt,
  SEGUNDOS_TOKEN_ACCESO,
} from './generador-tokens.jwt.js';

const SECRETO = 'una-firma-de-prueba-'.repeat(4);
const DATOS = {
  usuarioId: '0190a4f2-1c2b-7000-8000-000000000101',
  sesionId: '0190a4f2-1c2b-7000-8000-000000000301',
};

/** Las partes de un JWT, sin verificar la firma (para mirar qué lleva). */
function partes(token: string): { cabecera: unknown; carga: Record<string, unknown> } {
  const [cabecera = '', carga = ''] = token.split('.');
  return {
    cabecera: JSON.parse(Buffer.from(cabecera, 'base64url').toString()) as unknown,
    carga: JSON.parse(Buffer.from(carga, 'base64url').toString()) as Record<string, unknown>,
  };
}

describe('GeneradorTokensJwt', () => {
  let reloj: RelojFijo;
  let tokens: GeneradorTokensJwt;

  beforeEach(() => {
    reloj = new RelojFijo('2026-07-15T08:00:00-05:00');
    tokens = new GeneradorTokensJwt(
      new JwtService({ secret: SECRETO, verifyOptions: { algorithms: ['HS256'] } }),
      reloj,
      derivarClaveRefresco(SECRETO),
    );
  });

  it('firma HS256 con solo sub y sid, y 15 minutos de vida contados desde el reloj', async () => {
    const { token, expiraEnSegundos } = await tokens.firmarAcceso(DATOS);
    expect(expiraEnSegundos).toBe(SEGUNDOS_TOKEN_ACCESO);
    const { cabecera, carga } = partes(token);
    expect(cabecera).toEqual({ alg: 'HS256', typ: 'JWT' });
    const iat = Date.parse('2026-07-15T13:00:00Z') / 1000;
    expect(carga).toEqual({ sub: DATOS.usuarioId, sid: DATOS.sesionId, iat, exp: iat + 900 });
  });

  it('verifica el suyo hasta que vence (según el reloj)', async () => {
    const { token } = await tokens.firmarAcceso(DATOS);
    reloj.avanzarMinutos(14);
    expect(await tokens.verificarAcceso(token)).toEqual(DATOS);
    reloj.avanzarMinutos(1);
    expect(await tokens.verificarAcceso(token)).toBeNull();
  });

  it('rechaza uno firmado con otra clave, con alg none, mal formado o sin sub/sid', async () => {
    const otro = new JwtService({ secret: 'otra-firma-'.repeat(8) });
    const iat = Math.floor(reloj.ahora().getTime() / 1000);
    const ajeno = await otro.signAsync({ sub: 'a', sid: 'b', iat });
    const cabeceraNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url',
    );
    const cargaNone = Buffer.from(JSON.stringify({ sub: 'a', sid: 'b', iat })).toString(
      'base64url',
    );
    const sinSid = await new JwtService({ secret: SECRETO }).signAsync({ sub: 'a', iat });

    expect(await tokens.verificarAcceso(ajeno)).toBeNull();
    expect(await tokens.verificarAcceso(`${cabeceraNone}.${cargaNone}.`)).toBeNull();
    expect(await tokens.verificarAcceso('basura')).toBeNull();
    expect(await tokens.verificarAcceso(sinSid)).toBeNull();
  });

  it('secretos de 256 bits en base64url (43 caracteres), distintos cada vez', () => {
    const uno = tokens.nuevoSecreto();
    expect(uno).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokens.nuevoSecreto()).not.toBe(uno);
  });

  it('la huella es el SHA-256 en hexadecimal', () => {
    // SHA-256 de "abc" (vector de prueba del estándar).
    expect(tokens.huella('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  describe('refresh token firmado (SEG-05)', () => {
    const PARTES = { sesionId: DATOS.sesionId, secreto: 'S'.repeat(43) };

    it('lleva un HMAC-SHA256 de <sid>.<secreto>, con una clave derivada (no JWT_SECRETO)', () => {
      const token = tokens.armarRefresco(PARTES);
      const [sid, secreto, firma] = token.split('.');
      expect([sid, secreto]).toEqual([PARTES.sesionId, PARTES.secreto]);
      const conClave = (clave: Buffer | string) =>
        createHmac('sha256', clave).update(`${sid}.${secreto}`).digest('base64url');
      expect(firma).toBe(conClave(derivarClaveRefresco(SECRETO)));
      expect(firma).not.toBe(conClave(SECRETO));
      expect(tokens.abrirRefresco(token)).toEqual(PARTES);
    });

    it('la clave depende de JWT_SECRETO y mide 256 bits', () => {
      expect(derivarClaveRefresco(SECRETO)).toHaveLength(32);
      expect(derivarClaveRefresco(SECRETO).equals(derivarClaveRefresco('otro'.repeat(16)))).toBe(
        false,
      );
    });

    it('rechaza un token inventado, con otra clave, cambiado o sin firma', () => {
      const bueno = tokens.armarRefresco(PARTES);
      const [sid = '', secreto = '', firma = ''] = bueno.split('.');
      const otraClave = new GeneradorTokensJwt(
        new JwtService({ secret: SECRETO }),
        reloj,
        derivarClaveRefresco('otra-firma-'.repeat(8)),
      ).armarRefresco(PARTES);
      const otroSid = tokens.armarRefresco({ ...PARTES, sesionId: DATOS.usuarioId });

      expect(tokens.abrirRefresco(otraClave)).toBeNull();
      expect(tokens.abrirRefresco(`${sid}.${'T'.repeat(43)}.${firma}`)).toBeNull();
      expect(tokens.abrirRefresco(`${sid}.${secreto}.${otroSid.split('.')[2] ?? ''}`)).toBeNull();
      expect(tokens.abrirRefresco(`${sid}.${secreto}.${'A'.repeat(43)}`)).toBeNull();
      expect(tokens.abrirRefresco(`${sid}.${secreto}`)).toBeNull();
      expect(tokens.abrirRefresco('basura')).toBeNull();
    });
  });
});
