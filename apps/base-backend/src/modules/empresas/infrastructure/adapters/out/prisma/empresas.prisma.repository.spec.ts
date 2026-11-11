import { Prisma } from '../../../../../../generated/prisma/client.js';
import type { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import { Empresa } from '../../../../domain/entities/empresa.entity.js';
import { NombreEmpresaDuplicadoError } from '../../../../domain/errors/empresas.errors.js';
import { NombreEmpresa } from '../../../../domain/value-objects/nombre-empresa.vo.js';
import { EmpresasPrismaRepository } from './empresas.prisma.repository.js';

const ID = '0190a4f2-1c2b-7000-8000-000000000001';

function repositorioCon(empresa: Record<string, unknown>, otros: Record<string, unknown> = {}) {
  return new EmpresasPrismaRepository({
    tx: { empresa, ...otros },
  } as unknown as TransaccionPrisma);
}

function duplicado(indice: string) {
  return new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: '7',
    meta: { driverAdapterError: { cause: { constraint: { index: indice } } } },
  });
}

describe('EmpresasPrismaRepository (sin base; con base en test/empresas.e2e-spec.ts)', () => {
  it('un id que no es UUID: null sin consultar', async () => {
    const findUnique = vi.fn();
    const findMany = vi.fn();
    const repositorio = repositorioCon({ findUnique, findMany });
    expect(await repositorio.buscarPorId('abc')).toBeNull();
    expect(await repositorio.buscarPorIds(['abc'])).toEqual([]);
    expect(await repositorio.buscarParaActualizar('abc')).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('buscarParaActualizar bloquea la fila (FOR UPDATE) antes de leerla', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const findUnique = vi.fn().mockResolvedValue({ id: ID, nombre: 'Acme', activo: true });
    const repositorio = repositorioCon({ findUnique }, { $queryRaw: queryRaw });
    expect((await repositorio.buscarParaActualizar(ID))?.nombre.valor).toBe('Acme');
    const [partes] = queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(partes.join('?')).toContain('FOR UPDATE');
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findUnique.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('el único del nombre se traduce a NombreEmpresaDuplicadoError', async () => {
    const error = duplicado('empresas_nombre_activas_key');
    const repositorio = repositorioCon({
      create: vi.fn(() => Promise.reject(error)),
      update: vi.fn(() => Promise.reject(error)),
    });
    await expect(repositorio.crear(NombreEmpresa.crear('Acme'), null)).rejects.toThrow(
      NombreEmpresaDuplicadoError,
    );
    await expect(
      repositorio.guardar(Empresa.reconstruir({ id: ID, nombre: 'Acme', activo: true }), null),
    ).rejects.toThrow(NombreEmpresaDuplicadoError);
  });

  it('otro error sigue igual', async () => {
    const error = duplicado('otro_key');
    const repositorio = repositorioCon({ create: vi.fn(() => Promise.reject(error)) });
    await expect(repositorio.crear(NombreEmpresa.crear('Acme'), null)).rejects.toBe(error);
  });
});
