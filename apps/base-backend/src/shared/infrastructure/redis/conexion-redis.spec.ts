import { Logger } from '@nestjs/common';
import { crearConexionRedis, prefijoRedis } from './conexion-redis.js';

describe('prefijoRedis', () => {
  it('es el nombre de la base: desarrollo y pruebas no se mezclan', () => {
    expect(prefijoRedis('postgresql://u:c@localhost:5433/base_erp')).toBe('base_erp:');
    expect(prefijoRedis('postgresql://u:c@localhost:5433/base_erp_test?schema=public')).toBe(
      'base_erp_test:',
    );
  });

  it('sin nombre de base, «sin-base»', () => {
    expect(prefijoRedis('postgresql://u:c@localhost:5433')).toBe('sin-base:');
  });
});

describe('crearConexionRedis', () => {
  it('con Redis caído no espera: la orden falla enseguida y el log avisa una sola vez', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    // Un puerto donde no hay nadie.
    const conexion = crearConexionRedis({ url: 'redis://127.0.0.1:1', prefijo: 'x:' });
    try {
      await expect(conexion.get('clave')).rejects.toThrow();
      await vi.waitFor(() => expect(error).toHaveBeenCalled());
      await new Promise((listo) => setTimeout(listo, 500));

      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Redis no responde'));
      expect(conexion.options.keyPrefix).toBe('x:');
    } finally {
      conexion.disconnect();
      error.mockRestore();
    }
  });
});
