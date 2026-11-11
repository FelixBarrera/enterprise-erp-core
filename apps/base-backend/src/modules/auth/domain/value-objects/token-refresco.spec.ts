import { armarTokenRefresco, contenidoAFirmar, separarTokenRefresco } from './token-refresco.js';

const SID = '0190a4f2-1c2b-7000-8000-000000000301';
const SECRETO = 'A'.repeat(20) + '_-' + 'z9'.repeat(10) + 'b';
const FIRMA = 'F'.repeat(21) + '-_' + '0x'.repeat(10);

describe('token de refresco', () => {
  it('se arma como <sid>.<secreto>.<firma> y se separa de vuelta', () => {
    const token = armarTokenRefresco({ sesionId: SID, secreto: SECRETO }, FIRMA);
    expect(token).toBe(`${SID}.${SECRETO}.${FIRMA}`);
    expect(separarTokenRefresco(token)).toEqual({ sesionId: SID, secreto: SECRETO, firma: FIRMA });
  });

  it('lo que se firma es <sid>.<secreto>', () => {
    expect(contenidoAFirmar({ sesionId: SID, secreto: SECRETO })).toBe(`${SID}.${SECRETO}`);
  });

  it.each([
    ['vacío', ''],
    ['sin firma (la forma de antes del 6.13f)', `${SID}.${SECRETO}`],
    ['sin puntos', `${SID}${SECRETO}${FIRMA}`],
    ['sid que no es UUID', `abc.${SECRETO}.${FIRMA}`],
    ['secreto corto', `${SID}.${SECRETO.slice(1)}.${FIRMA}`],
    ['secreto largo', `${SID}.${SECRETO}x.${FIRMA}`],
    ['firma corta', `${SID}.${SECRETO}.${FIRMA.slice(1)}`],
    ['firma larga', `${SID}.${SECRETO}.${FIRMA}x`],
    ['secreto con caracteres de fuera de base64url', `${SID}.${SECRETO.slice(1)}+.${FIRMA}`],
    ['firma con caracteres de fuera de base64url', `${SID}.${SECRETO}.${FIRMA.slice(1)}=`],
    ['con algo más al final', `${SID}.${SECRETO}.${FIRMA}.otro`],
    ['sid en mayúsculas', `${SID.toUpperCase()}.${SECRETO}.${FIRMA}`],
  ])('no acepta un token %s', (_caso, token) => {
    expect(separarTokenRefresco(token)).toBeNull();
  });
});
