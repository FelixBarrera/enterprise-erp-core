import { config as cargarEnv } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { urlBaseDePruebas } from './test/utilidades/base-de-pruebas.js';

// Las variables del sistema (CI) mandan; si no están, se leen del .env.
cargarEnv({ quiet: true });
const DATABASE_URL = urlBaseDePruebas(process.env);
process.env['DATABASE_URL'] = DATABASE_URL;

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    // Los decoradores (class-validator, NestJS) necesitan reflect-metadata cargado antes.
    setupFiles: ['reflect-metadata'],
    include: ['test/**/*.e2e-spec.ts'],
    // Crea y migra la base _test antes de empezar.
    globalSetup: ['test/global-setup.ts'],
    // Las pruebas usan la base _test, nunca la de desarrollo.
    // Sin logs en la consola (test/logs.e2e-spec.ts los lee en memoria).
    // Y el proceso en otra zona a propósito (como un servidor en EE. UU.): regla 11.
    // Límites altos: los e2e entran muchas veces seguidas desde la misma IP. El del límite
    // (test/limite-peticiones.e2e-spec.ts) pone los suyos.
    env: {
      DATABASE_URL,
      NODE_ENV: 'test',
      TZ: 'America/New_York',
      LOG_LEVEL: 'silent',
      LIMITE_LOGIN_POR_MINUTO: '100000',
      LIMITE_USUARIO_POR_MINUTO: '100000',
      LIMITE_IP_POR_MINUTO: '100000',
    },
    // En serie: comparten la misma base.
    fileParallelism: false,
  },
});
