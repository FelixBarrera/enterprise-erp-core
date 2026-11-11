import type { ConfigService } from '@nestjs/config';
import {
  fijarZonaNegocio,
  ZONA_NEGOCIO_POR_DEFECTO,
  zonaNegocio,
} from '../../domain/zona-negocio.js';
import type { EnvironmentVariables } from '../config/environment-variables.js';
import { AplicarZonaNegocio } from './zona-negocio.module.js';

describe('AplicarZonaNegocio', () => {
  afterEach(() => {
    fijarZonaNegocio(ZONA_NEGOCIO_POR_DEFECTO);
  });

  it('fija la zona que dice el .env', () => {
    const config = { get: () => 'Europe/Madrid' } as unknown as ConfigService<
      EnvironmentVariables,
      true
    >;
    new AplicarZonaNegocio(config);
    expect(zonaNegocio()).toBe('Europe/Madrid');
  });
});
