import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { VerificadorSaludPort } from '../../../../application/ports/out/verificador-salud.port';
import type { EstadoSalud } from '../../../../domain/estado-salud';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { HealthApi } from './health.api';

/** Traduce la respuesta HTTP al estado del dominio. */
@Injectable()
export class VerificadorSaludHttpAdapter implements VerificadorSaludPort {
  private readonly api = inject(HealthApi);

  async consultar(): Promise<EstadoSalud> {
    try {
      const respuesta = await firstValueFrom(this.api.obtener());
      return respuesta.data.disponible ? 'en-marcha' : 'sin-base-datos';
    } catch (error) {
      return esRespuestaDelBackend503(error) ? 'sin-base-datos' : 'sin-servidor';
    }
  }
}

/** Un 503 que mandó la API (con su forma `{ success: false }`): la base no responde. Otro, no. */
function esRespuestaDelBackend503(error: unknown): boolean {
  return (
    error instanceof ErrorHttp &&
    error.estado === 503 &&
    error.tipo === TipoErrorHttp.SERVIDOR_NO_DISPONIBLE &&
    error.respondioLaApi
  );
}
