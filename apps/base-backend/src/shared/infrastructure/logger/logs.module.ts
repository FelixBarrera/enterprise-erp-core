import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { pinoHttp, type HttpLogger } from 'pino-http';
import type { EnvironmentVariables } from '../config/environment-variables.js';
import { LoggerNest } from './logger-nest.js';
import { crearOpcionesLogs, type OpcionesLogs } from './opciones-logs.js';

/**
 * Solo pruebas: `overrideProvider(DESTINO_LOGS).useValue({ destino, nivel })` para leer los
 * logs en memoria. Por defecto, `null` (la consola y el `LOG_LEVEL` del .env).
 */
export const DESTINO_LOGS = Symbol('DESTINO_LOGS');
export interface DestinoLogs {
  destino: DestinationStream;
  nivel: 'info' | 'debug';
}

/** El middleware que escribe la línea de cada petición. Lo monta `configureApp()`. */
export const MIDDLEWARE_LOGS = Symbol('MIDDLEWARE_LOGS');
const OPCIONES_LOGS = Symbol('OPCIONES_LOGS');

@Global()
@Module({
  providers: [
    { provide: DESTINO_LOGS, useValue: null },
    {
      provide: OPCIONES_LOGS,
      inject: [ConfigService, DESTINO_LOGS],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        prueba: DestinoLogs | null,
      ): OpcionesLogs =>
        crearOpcionesLogs({
          entorno: config.get('NODE_ENV', { infer: true }),
          nivel: prueba?.nivel ?? config.get('LOG_LEVEL', { infer: true }),
          destino: prueba?.destino,
        }),
    },
  ],
  exports: [DESTINO_LOGS, OPCIONES_LOGS],
})
class OpcionesLogsModule {}

/**
 * Logs con nestjs-pino (docs/arquitectura-backend.md, sección 10). En el código se usa
 * `new Logger(Clase.name)` de `@nestjs/common`, como siempre: por debajo escribe con pino y,
 * dentro de una petición, agrega su número.
 *
 * La línea de cada petición la escribe `MIDDLEWARE_LOGS`, que `configureApp()` monta ANTES de
 * que NestJS lea el cuerpo: si no, un JSON mal escrito respondería 400 sin dejar rastro.
 * Por eso nestjs-pino va con `useExisting` (usa ese middleware en vez de montar el suyo).
 */
@Global()
@Module({
  imports: [
    OpcionesLogsModule,
    LoggerModule.forRootAsync({
      inject: [OPCIONES_LOGS],
      useFactory: (opciones: OpcionesLogs) => ({ pinoHttp: opciones, useExisting: true }),
    }),
  ],
  providers: [
    LoggerNest,
    {
      provide: MIDDLEWARE_LOGS,
      inject: [OPCIONES_LOGS],
      useFactory: (opciones: OpcionesLogs): HttpLogger<Request, Response> =>
        Array.isArray(opciones) ? pinoHttp(...opciones) : pinoHttp(opciones),
    },
  ],
  exports: [LoggerNest, MIDDLEWARE_LOGS],
})
export class LogsModule {}
