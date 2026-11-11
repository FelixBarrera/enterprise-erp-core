import type { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import { AccesosSesionPrismaRepository } from './accesos-sesion.prisma.repository.js';

const SID = '0190a4f2-1c2b-7000-8000-000000000301';

describe('AccesosSesionPrismaRepository (sin base; con base en test/auth-sesion.e2e-spec.ts)', () => {
  it('con un id sin forma de UUID no consulta y devuelve null', async () => {
    const $queryRaw = vi.fn();
    const repositorio = new AccesosSesionPrismaRepository({
      tx: { $queryRaw },
    } as unknown as TransaccionPrisma);

    await expect(repositorio.buscar('no-es-uuid', null)).resolves.toBeNull();
    expect($queryRaw).not.toHaveBeenCalled();
  });

  it('si la sesión no existe devuelve null', async () => {
    const repositorio = new AccesosSesionPrismaRepository({
      tx: { $queryRaw: vi.fn().mockResolvedValue([]) },
    } as unknown as TransaccionPrisma);

    await expect(repositorio.buscar(SID, null)).resolves.toBeNull();
  });
});
