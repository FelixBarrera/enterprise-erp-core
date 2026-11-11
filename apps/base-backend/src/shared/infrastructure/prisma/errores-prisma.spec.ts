import { Prisma } from '../../../generated/prisma/client.js';
import { indiceUnicoViolado } from './errores-prisma.js';

function errorPrisma(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('falló', { code, clientVersion: '7', meta });
}

const META_ADAPTADOR = {
  driverAdapterError: { cause: { constraint: { index: 'empresas_nombre_activas_key' } } },
};

describe('indiceUnicoViolado()', () => {
  it('P2002 con el nombre del índice (como lo manda @prisma/adapter-pg)', () => {
    const error = errorPrisma('P2002', META_ADAPTADOR);
    expect(indiceUnicoViolado(error)).toBe(true);
    expect(indiceUnicoViolado(error, 'empresas_nombre_activas_key')).toBe(true);
    expect(indiceUnicoViolado(error, 'otro_key')).toBe(false);
  });

  it('P2002 sin el nombre: solo coincide sin índice', () => {
    const error = errorPrisma('P2002', {
      driverAdapterError: { cause: { constraint: { fields: ['x'] } } },
    });
    expect(indiceUnicoViolado(error)).toBe(true);
    expect(indiceUnicoViolado(error, 'empresas_nombre_activas_key')).toBe(false);
    expect(indiceUnicoViolado(errorPrisma('P2002'), 'x')).toBe(false);
  });

  it('otro código u otro error: no', () => {
    expect(indiceUnicoViolado(errorPrisma('P2025', META_ADAPTADOR))).toBe(false);
    expect(indiceUnicoViolado(new Error('P2002'))).toBe(false);
    expect(indiceUnicoViolado(null)).toBe(false);
  });
});
