import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

/** La conexión a Redis de la API (una sola, compartida). Solo en `infrastructure/`. */
export const CONEXION_REDIS = Symbol('CONEXION_REDIS');

/** Lo más que se espera a Redis en cada orden: si tarda más, se sigue sin él. */
export const TIEMPO_MAXIMO_REDIS_MS = 500;

export interface OpcionesConexionRedis {
  /** `REDIS_URL` del `.env`. */
  readonly url: string;
  /** Delante de cada clave (`base_erp:`), para que desarrollo y pruebas no se mezclen. */
  readonly prefijo: string;
}

/**
 * El prefijo de las claves: el nombre de la base de `DATABASE_URL` (`base_erp`, `base_erp_test`),
 * igual que el de las colas (docs/arquitectura-backend.md, sección 6).
 */
export function prefijoRedis(databaseUrl: string): string {
  const nombre = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  return `${nombre === '' ? 'sin-base' : nombre}:`;
}

/**
 * Crea la conexión. Si Redis no responde, **no espera**: cada orden falla enseguida (sin cola
 * de espera) o a los 500 ms, y quien la usa decide qué hacer (el límite de peticiones deja
 * pasar, AUTH-D17). Se reconecta sola; el log avisa una vez al caerse y otra al volver.
 */
export function crearConexionRedis(opciones: OpcionesConexionRedis): Redis {
  const logger = new Logger('Redis');
  const conexion = new Redis(opciones.url, {
    keyPrefix: opciones.prefijo,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    commandTimeout: TIEMPO_MAXIMO_REDIS_MS,
    connectTimeout: 2_000,
    // Reintenta cada vez más espaciado, hasta cada 5 s, sin rendirse nunca.
    retryStrategy: (intento: number) => Math.min(intento * 200, 5_000),
  });
  let caida = false;
  conexion.on('error', (error: Error) => {
    if (!caida) {
      caida = true;
      logger.error(`Redis no responde: ${error.message}`);
    }
  });
  conexion.on('ready', () => {
    if (caida) {
      caida = false;
      logger.log('Redis volvió a responder');
    }
  });
  return conexion;
}
