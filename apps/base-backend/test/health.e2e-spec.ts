import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import request from 'supertest';
import { VERIFICADOR_BASE_DATOS_PORT } from '../src/modules/health/application/ports/out/verificador-base-datos.port.js';
import { crearApp } from './utilidades/crear-app.js';

describe('GET /api/v1/health (e2e)', () => {
  describe('con la base de datos en marcha', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await crearApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('responde 200 con el estado de cada dependencia', async () => {
      const respuesta = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(respuesta.body).toEqual({
        success: true,
        data: { disponible: true, baseDatos: 'ok' },
        message: 'Servicio en marcha',
      });
    });

    it('la ruta vieja /api ya no existe', async () => {
      await request(app.getHttpServer()).get('/api').expect(404);
    });
  });

  describe('con la base de datos caída', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await crearApp({
        sobrescribir: (builder) =>
          builder
            .overrideProvider(VERIFICADOR_BASE_DATOS_PORT)
            .useValue({ responde: () => Promise.resolve(false) }),
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('responde 503 para que el monitoreo avise', async () => {
      const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const respuesta = await request(app.getHttpServer()).get('/api/v1/health').expect(503);
      expect(respuesta.body).toEqual({
        success: false,
        data: null,
        message: 'El servicio no está disponible en este momento',
      });
      log.mockRestore();
    });
  });
});
