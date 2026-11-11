import { type Provider } from '@angular/core';
import { CONSULTAR_SALUD_PORT } from './application/ports/in/consultar-salud.port';
import { VERIFICADOR_SALUD_PORT } from './application/ports/out/verificador-salud.port';
import { ConsultarSaludUseCase } from './application/use-cases/consultar-salud.use-case';
import { HealthApi } from './infrastructure/adapters/out/http/health.api';
import { VerificadorSaludHttpAdapter } from './infrastructure/adapters/out/http/verificador-salud.http.adapter';

/** Se registran en la ruta lazy del módulo (`health.routes.ts`), no en `app.config.ts`. */
export const HEALTH_PROVIDERS: Provider[] = [
  HealthApi,
  { provide: VERIFICADOR_SALUD_PORT, useClass: VerificadorSaludHttpAdapter },
  { provide: CONSULTAR_SALUD_PORT, useClass: ConsultarSaludUseCase },
];
