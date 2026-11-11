import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const minimo = (porcentaje: number) => ({
  statements: porcentaje,
  branches: porcentaje,
  functions: porcentaje,
  lines: porcentaje,
});

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    // Los decoradores (class-validator, NestJS) necesitan reflect-metadata cargado antes.
    setupFiles: ['reflect-metadata'],
    include: ['src/**/*.spec.ts'],
    // A propósito, el proceso en otra zona (como un servidor en EE. UU.): nada debe depender
    // de ella (regla 11). Las pruebas de FechaFiscal prueban además otras zonas.
    env: { TZ: 'America/New_York' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/generated/**',
        'src/main.ts',
        'src/comandos/**',
        'src/**/*.module.ts',
        'src/**/*.spec.ts',
      ],
      // Mínimos de docs/arquitectura-backend.md (sección 15). `pnpm test:cov` y el CI fallan
      // si bajan. Lo fiscal (90 %) se agrega con su módulo.
      thresholds: {
        'src/modules/*/application/use-cases/**': minimo(80),
        'src/**/adapters/out/**': minimo(60),
        'src/**/adapters/in/http/**': minimo(40),
      },
    },
  },
});
