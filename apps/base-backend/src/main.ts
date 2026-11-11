import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import type { EnvironmentVariables } from './shared/infrastructure/config/environment-variables.js';
import { configureApp, PREFIJO_API } from './shared/infrastructure/http/configure-app.js';
import { LoggerNest } from './shared/infrastructure/logger/logger-nest.js';

async function bootstrap(): Promise<void> {
  // bufferLogs: lo que se escribe antes de tener el logger sale después, con el formato de pino.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(LoggerNest));
  configureApp(app);
  app.enableShutdownHooks();
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const puerto = config.get('PORT', { infer: true });
  await app.listen(puerto);
  new Logger('Arranque').log(
    `API en marcha en el puerto ${puerto} (/${PREFIJO_API}, ${config.get('NODE_ENV', { infer: true })})`,
  );
}
await bootstrap();
