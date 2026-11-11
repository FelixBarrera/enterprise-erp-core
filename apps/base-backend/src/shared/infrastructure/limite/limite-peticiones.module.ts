import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/environment-variables.js';
import { AlmacenLimiteRedis } from './almacen-limite.redis.js';
import { ALMACEN_LIMITE, OPCIONES_LIMITE, type OpcionesLimite } from './opciones-limite.js';

type Config = ConfigService<EnvironmentVariables, true>;

/**
 * Global: las opciones y el almacenamiento del límite de peticiones (AUTH-D17). El guard
 * (`LimitePeticionesGuard`) lo registra `AuthModule` justo después de `SesionGuard`: así sabe
 * si la petición tiene sesión.
 */
@Global()
@Module({
  providers: [
    {
      provide: OPCIONES_LIMITE,
      inject: [ConfigService],
      useFactory: (config: Config): OpcionesLimite => ({
        loginPorMinuto: config.get('LIMITE_LOGIN_POR_MINUTO', { infer: true }),
        usuarioPorMinuto: config.get('LIMITE_USUARIO_POR_MINUTO', { infer: true }),
        ipPorMinuto: config.get('LIMITE_IP_POR_MINUTO', { infer: true }),
      }),
    },
    { provide: ALMACEN_LIMITE, useClass: AlmacenLimiteRedis },
  ],
  exports: [OPCIONES_LIMITE, ALMACEN_LIMITE],
})
export class LimitePeticionesModule {}
