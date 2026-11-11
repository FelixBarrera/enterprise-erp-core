import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { EnvironmentVariables } from '../config/environment-variables.js';
import { CONEXION_REDIS, crearConexionRedis, prefijoRedis } from './conexion-redis.js';

type Config = ConfigService<EnvironmentVariables, true>;

/**
 * Global: la conexión a Redis (`CONEXION_REDIS`), solo para adaptadores de `infrastructure/`.
 * Hoy la usa el límite de peticiones (6.5e); después, las colas. Se cierra al apagar la API
 * (y al terminar un comando `admin:*`).
 */
@Global()
@Module({
  providers: [
    {
      provide: CONEXION_REDIS,
      inject: [ConfigService],
      useFactory: (config: Config): Redis =>
        crearConexionRedis({
          url: config.get('REDIS_URL', { infer: true }),
          prefijo: prefijoRedis(config.get('DATABASE_URL', { infer: true })),
        }),
    },
  ],
  exports: [CONEXION_REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(CONEXION_REDIS) private readonly conexion: Redis) {}

  onApplicationShutdown(): void {
    this.conexion.disconnect();
  }
}
