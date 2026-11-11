import { ConfigService } from '@nestjs/config';
import {
  CREAR_INSTALACION_INICIAL_PORT,
  type CrearInstalacionInicialPort,
} from '../modules/auth/application/ports/in/crear-instalacion-inicial.port.js';
import { ComandoCrearInicial } from '../modules/auth/infrastructure/adapters/in/cli/comando-crear-inicial.js';
import type { EnvironmentVariables } from '../shared/infrastructure/config/environment-variables.js';
import { ejecutarComando } from './ejecutar-comando.js';

/** `pnpm admin:crear-inicial` (ver `ComandoCrearInicial`). */
await ejecutarComando((app, terminal) => {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  return new ComandoCrearInicial(
    app.get<CrearInstalacionInicialPort>(CREAR_INSTALACION_INICIAL_PORT),
    {
      EMPRESA_INICIAL_NOMBRE: config.get('EMPRESA_INICIAL_NOMBRE', { infer: true }),
      ADMIN_INICIAL_USUARIO: config.get('ADMIN_INICIAL_USUARIO', { infer: true }),
      ADMIN_INICIAL_NOMBRE: config.get('ADMIN_INICIAL_NOMBRE', { infer: true }),
      ADMIN_INICIAL_CONTRASENA: config.get('ADMIN_INICIAL_CONTRASENA', { infer: true }),
    },
    terminal,
  );
});
