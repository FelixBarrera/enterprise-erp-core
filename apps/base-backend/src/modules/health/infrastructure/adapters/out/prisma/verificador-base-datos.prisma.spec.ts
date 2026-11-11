import { Logger } from '@nestjs/common';
import type { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import {
  TIEMPO_MAXIMO_BASE_DATOS_MS,
  VerificadorBaseDatosPrisma,
} from './verificador-base-datos.prisma.js';

const conConsulta = (consulta: () => Promise<unknown>) =>
  new VerificadorBaseDatosPrisma({ tx: { $queryRaw: consulta } } as unknown as TransaccionPrisma);

describe('VerificadorBaseDatosPrisma', () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
    vi.useRealTimers();
  });

  it('true si la base contesta', async () => {
    await expect(conConsulta(() => Promise.resolve([{ '?column?': 1 }])).responde()).resolves.toBe(
      true,
    );
    expect(log).not.toHaveBeenCalled();
  });

  it('false (y al log) si la consulta falla', async () => {
    await expect(
      conConsulta(() => Promise.reject(new Error('conexión rechazada'))).responde(),
    ).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('conexión rechazada'));
  });

  it('false también si lo que falla no es un Error', async () => {
    await expect(conConsulta(() => Promise.reject('texto suelto')).responde()).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('texto suelto'));
  });

  it('false si la base no contesta a tiempo', async () => {
    vi.useFakeTimers();
    const resultado = conConsulta(() => new Promise(() => undefined)).responde();
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_BASE_DATOS_MS);
    await expect(resultado).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('sin respuesta'));
  });
});
