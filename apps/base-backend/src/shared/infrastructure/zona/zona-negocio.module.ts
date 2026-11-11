import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fijarZonaNegocio } from '../../domain/zona-negocio.js';
import type { EnvironmentVariables } from '../config/environment-variables.js';

/**
 * Fija la zona del negocio (`ZONA_NEGOCIO` del `.env`, ya validada al arrancar) para
 * `FechaFiscal` y la hora de los logs. NestJS crea esta pieza al levantar la app, antes de
 * atender la primera petición.
 */
@Injectable()
export class AplicarZonaNegocio {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    fijarZonaNegocio(config.get('ZONA_NEGOCIO', { infer: true }));
  }
}

@Global()
@Module({ providers: [AplicarZonaNegocio] })
export class ZonaNegocioModule {}
