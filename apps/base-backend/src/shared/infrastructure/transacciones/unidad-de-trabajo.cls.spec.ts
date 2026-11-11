import type { TransaccionPrisma } from './transaccion-prisma.js';
import { UnidadDeTrabajoCls } from './unidad-de-trabajo.cls.js';

function hostFalso() {
  const withTransaction = vi.fn((...args: unknown[]) => {
    const fn = args.at(-1) as () => Promise<unknown>;
    return fn();
  });
  return { host: { withTransaction } as unknown as TransaccionPrisma, withTransaction };
}

describe('UnidadDeTrabajoCls', () => {
  it('sin opciones abre la transacción con lo de siempre y devuelve lo que da fn', async () => {
    const { host, withTransaction } = hostFalso();
    await expect(new UnidadDeTrabajoCls(host).ejecutar(() => Promise.resolve(42))).resolves.toBe(
      42,
    );
    expect(withTransaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it('con tiempoMaximoMs se lo pasa a Prisma como timeout', async () => {
    const { host, withTransaction } = hostFalso();
    await new UnidadDeTrabajoCls(host).ejecutar(() => Promise.resolve('ok'), {
      tiempoMaximoMs: 30_000,
    });
    expect(withTransaction).toHaveBeenCalledWith({ timeout: 30_000 }, expect.any(Function));
  });

  it('el error de fn sigue su camino', async () => {
    const { host } = hostFalso();
    await expect(
      new UnidadDeTrabajoCls(host).ejecutar(() => Promise.reject(new Error('falló'))),
    ).rejects.toThrow('falló');
  });
});
