import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RelojFijo } from '../../application/testing/reloj-fijo.js';
import { AlmacenLimiteRedis } from './almacen-limite.redis.js';

describe('AlmacenLimiteRedis', () => {
  const evalRedis = vi.fn();
  const redis = { eval: evalRedis } as unknown as Redis;
  let reloj: RelojFijo;
  let almacen: AlmacenLimiteRedis;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    evalRedis.mockReset();
    reloj = new RelojFijo('2026-07-15T11:00:00-05:00');
    almacen = new AlmacenLimiteRedis(redis, reloj);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    error.mockRestore();
  });

  it('cuenta en Redis con su clave y la del bloqueo, y pasa los milisegundos a segundos', async () => {
    evalRedis.mockResolvedValue([3, 41_200, 0, 0]);

    await expect(almacen.increment('ip:10.0.0.5', 60_000, 10, 60_000)).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 42,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(evalRedis).toHaveBeenCalledWith(
      expect.stringContaining('INCR'),
      2,
      'limite:ip:10.0.0.5',
      'limite:ip:10.0.0.5:bloqueo',
      60_000,
      10,
      60_000,
    );
  });

  it('bloqueado: lo dice, con los segundos que faltan', async () => {
    evalRedis.mockResolvedValue([11, 59_000, 1, 59_001]);

    await expect(almacen.increment('login:10.0.0.5', 60_000, 10, 60_000)).resolves.toMatchObject({
      isBlocked: true,
      timeToBlockExpire: 60,
    });
  });

  it('si Redis falla, deja pasar y lo registra una vez por minuto', async () => {
    evalRedis.mockRejectedValue(new Error('Connection is closed.'));
    const sinLimite = { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };

    await expect(almacen.increment('ip:x', 60_000, 10, 60_000)).resolves.toEqual(sinLimite);
    await expect(almacen.increment('ip:x', 60_000, 10, 60_000)).resolves.toEqual(sinLimite);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Connection is closed.'));

    reloj.avanzarMinutos(1);
    await almacen.increment('ip:x', 60_000, 10, 60_000);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('una respuesta inesperada de Redis también deja pasar', async () => {
    for (const rara of [null, 'OK', [1, 2, 3], [1, '2', 0, 0]]) {
      evalRedis.mockResolvedValueOnce(rara);
      await expect(almacen.increment('ip:x', 60_000, 10, 60_000)).resolves.toMatchObject({
        isBlocked: false,
      });
    }
    expect(error).toHaveBeenCalledWith(expect.stringContaining('respuesta inesperada'));
  });
});
