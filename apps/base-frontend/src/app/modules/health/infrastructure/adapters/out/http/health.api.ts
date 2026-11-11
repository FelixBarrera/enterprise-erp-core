import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { RespuestaApi } from '../../../../../../shared/infrastructure/http/respuesta-api';
import { SIN_AVISO_GLOBAL } from '../../../../../../shared/infrastructure/http/errores.interceptor';
import { URL_API } from '../../../../../../shared/infrastructure/http/url-api';

/** Lo que manda el backend en `data` de `GET /api/v1/health`. */
export interface EstadoSaludDto {
  disponible: boolean;
  baseDatos: 'ok' | 'falla';
}

/** HTTP crudo: solo las llamadas, sin convertir nada. */
@Injectable()
export class HealthApi {
  private readonly http = inject(HttpClient);

  obtener(): Observable<RespuestaApi<EstadoSaludDto>> {
    // La pantalla muestra ella misma si no hay servidor: sin el aviso global del interceptor.
    return this.http.get<RespuestaApi<EstadoSaludDto>>(`${URL_API}/health`, {
      context: new HttpContext().set(SIN_AVISO_GLOBAL, true),
    });
  }
}
