import type { Redis } from 'ioredis';
import { PREFIJO_CLAVES_LIMITE } from '../../src/shared/infrastructure/limite/almacen-limite.redis.js';

/**
 * Borra los contadores del límite de peticiones, solo los de la base de pruebas (la conexión ya
 * pone el prefijo `<bd>_test:`). Si el prefijo no termina en `_test:`, falla sin borrar nada.
 */
export async function vaciarLimites(redis: Redis): Promise<void> {
  const prefijo = redis.options.keyPrefix ?? '';
  if (!prefijo.endsWith('_test:')) {
    throw new Error(`vaciarLimites(): el prefijo "${prefijo}" no es el de la base de pruebas`);
  }
  // ioredis no pone el prefijo en el patrón de KEYS (sí en DEL): va a mano y se quita antes de DEL.
  const claves = await redis.keys(`${prefijo}${PREFIJO_CLAVES_LIMITE}*`);
  if (claves.length > 0) {
    await redis.del(...claves.map((clave) => clave.slice(prefijo.length)));
  }
}
