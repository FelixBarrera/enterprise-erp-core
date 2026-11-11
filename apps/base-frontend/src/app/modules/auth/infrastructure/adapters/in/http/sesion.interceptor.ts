import { type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { URL_API } from '../../../../../../shared/infrastructure/http/url-api';
import { SIN_INTERCEPTOR_SESION } from '../../out/http/auth.api';
import { SesionFacade } from '../../../presentation/facades/sesion.facade';
import { AuthStore } from '../../../presentation/stores/auth.store';

/**
 * Pone el access token en cada petición a la API y, si el backend responde 401 (token vencido),
 * renueva **una vez** (la misma renovación para todas las que fallaron juntas) y repite la
 * petición **una sola vez**. Si la sesión terminó, al login. Sin conexión, el error sigue su
 * camino y la sesión se mantiene (docs/arquitectura-frontend.md, sección 6).
 *
 * Va **antes** que el de errores: recibe el `ErrorHttp` ya traducido.
 */
export const sesionInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  if (peticion.context.get(SIN_INTERCEPTOR_SESION) || !esDeLaApi(peticion)) {
    return siguiente(peticion);
  }
  const store = inject(AuthStore);
  const facade = inject(SesionFacade);
  const token = store.token();

  return siguiente(conToken(peticion, token)).pipe(
    catchError((error: unknown) => {
      const vencido = error instanceof ErrorHttp && error.tipo === TipoErrorHttp.NO_AUTENTICADO;
      if (!vencido || token === null) return throwError(() => error);
      return from(facade.renovar(token)).pipe(
        switchMap((nuevo) => {
          if (nuevo === null) {
            void facade.irAlLogin();
            return throwError(() => error);
          }
          return siguiente(conToken(peticion, nuevo));
        }),
      );
    }),
  );
};

function esDeLaApi(peticion: HttpRequest<unknown>): boolean {
  return peticion.url === URL_API || peticion.url.startsWith(`${URL_API}/`);
}

function conToken(peticion: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (token === null) return peticion;
  return peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
