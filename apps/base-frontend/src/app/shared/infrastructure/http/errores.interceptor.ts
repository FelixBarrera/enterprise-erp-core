import { HttpContextToken, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificacionesService } from '../avisos/notificaciones.service';
import { traducirErrorHttp } from './traducir-error-http';

/**
 * Para una petición que muestra ella misma su falla (por ejemplo, la pantalla del estado
 * del servicio): `{ context: new HttpContext().set(SIN_AVISO_GLOBAL, true) }`.
 */
export const SIN_AVISO_GLOBAL = new HttpContextToken<boolean>(() => false);

/**
 * Todo error HTTP sale de aquí como `ErrorHttp` (docs/arquitectura-frontend.md, regla 9).
 * Sin red, 5xx y 403 → aviso global; 401 → interceptor de auth (paso 6); el resto → la pantalla.
 * **Sin reintentos automáticos**: repetir un POST duplicaría.
 */
export const erroresInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const avisos = inject(NotificacionesService);
  return siguiente(peticion).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      const errorHttp = traducirErrorHttp(error, !peticion.context.get(SIN_AVISO_GLOBAL));
      if (errorHttp.avisado) void avisos.error(errorHttp.message);
      return throwError(() => errorHttp);
    }),
  );
};
