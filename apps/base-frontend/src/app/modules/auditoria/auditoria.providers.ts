import type { Provider } from '@angular/core';
import { CONSULTAR_BITACORA_PORT } from './application/ports/in/consultar-bitacora.port';
import { BITACORA_REMOTA_PORT } from './application/ports/out/bitacora-remota.port';
import { ConsultarBitacoraUseCase } from './application/use-cases/consultar-bitacora.use-case';
import { BitacoraApi } from './infrastructure/adapters/out/http/bitacora.api';
import { BitacoraRemotaHttpAdapter } from './infrastructure/adapters/out/http/bitacora-remota.http.adapter';

/** Se registran en la ruta lazy del módulo (`auditoria.routes.ts`). */
export const AUDITORIA_PROVIDERS: Provider[] = [
  BitacoraApi,
  { provide: BITACORA_REMOTA_PORT, useClass: BitacoraRemotaHttpAdapter },
  { provide: CONSULTAR_BITACORA_PORT, useClass: ConsultarBitacoraUseCase },
];
