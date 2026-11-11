import type { Provider, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/shared/infrastructure/http/configure-app.js';
import { LoggerNest } from '../../src/shared/infrastructure/logger/logger-nest.js';

interface OpcionesCrearApp {
  /** Controllers solo de prueba. */
  controllers?: Type[];
  /** Providers solo de prueba (por ejemplo, un repositorio de prueba). */
  providers?: Provider[];
  /** Para reemplazar piezas: `(b) => b.overrideProvider(TOKEN).useValue(falso)`. */
  sobrescribir?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

/** Levanta la API para un e2e con la MISMA `configureApp()` que `main.ts`. */
export async function crearApp(opciones: OpcionesCrearApp = {}): Promise<NestExpressApplication> {
  const { controllers = [], providers = [], sobrescribir = (builder) => builder } = opciones;
  const modulo = await sobrescribir(
    Test.createTestingModule({ imports: [AppModule], controllers, providers }),
  ).compile();
  const app = modulo.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  // Como main.ts: el logger de NestJS escribe con pino (en los e2e, LOG_LEVEL=silent).
  app.useLogger(app.get(LoggerNest));
  configureApp(app);
  await app.init();
  return app;
}
