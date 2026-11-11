import { defineConfig } from 'vitest/config';

const minimo = (porcentaje: number) => ({
  statements: porcentaje,
  branches: porcentaje,
  functions: porcentaje,
  lines: porcentaje,
});

// La carga `ng test` (opción `runnerConfig` en angular.json). Qué archivos se prueban lo decide
// Angular: aquí NO va `include` ni `exclude` (si se ponen, la cobertura sale en 0 %).
export default defineConfig({
  test: {
    // A propósito, el proceso en otra zona (como un navegador fuera de Ecuador): nada debe
    // depender de ella (regla 11).
    env: { TZ: 'America/New_York' },
    coverage: {
      provider: 'v8',
      // Mínimos de docs/arquitectura-frontend.md (sección 9). `pnpm test:cov` y el CI fallan
      // si bajan.
      thresholds: {
        'src/app/modules/*/application/use-cases/**': minimo(80),
        'src/app/**/presentation/stores/**': minimo(60),
        'src/app/**/adapters/in/**': minimo(40),
      },
    },
  },
});
