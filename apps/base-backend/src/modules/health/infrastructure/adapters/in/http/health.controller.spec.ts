import { ServiceUnavailableException } from '@nestjs/common';
import type { EstadoSalud } from '../../../../domain/estado-salud.js';
import { HealthController } from './health.controller.js';

const controller = (estado: EstadoSalud) =>
  new HealthController({ execute: () => Promise.resolve(estado) });

describe('HealthController', () => {
  it('responde ok() si el servicio está disponible', async () => {
    const estado: EstadoSalud = { disponible: true, baseDatos: 'ok' };
    await expect(controller(estado).consultar()).resolves.toEqual({
      success: true,
      data: estado,
      message: 'Servicio en marcha',
    });
  });

  it('lanza 503 si no está disponible', async () => {
    await expect(
      controller({ disponible: false, baseDatos: 'falla' }).consultar(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
