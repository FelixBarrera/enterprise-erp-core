import { inject } from '@angular/core';
import { type CanActivateFn, Router, type UrlTree } from '@angular/router';
import {
  destinoTrasIngreso,
  RUTA_CONTRASENA_TEMPORAL,
  RUTA_LOGIN,
  volverDesde,
} from '../../../../domain/destino-tras-ingreso';
import { SesionFacade } from '../../../presentation/facades/sesion.facade';
import { AuthStore } from '../../../presentation/stores/auth.store';

/**
 * Las pantallas del layout piden sesión. Al recargar la página no hay token (vive en memoria):
 * se pide uno con la cookie. Sin sesión (o sin conexión para recuperarla), al login, que después
 * vuelve aquí. Con una contraseña temporal, primero a cambiarla (AUTH-D14): el backend no deja
 * hacer nada más.
 */
export const sesionGuard: CanActivateFn = async (_ruta, estado) => {
  const router = inject(Router);
  const store = inject(AuthStore);
  const volver = volverDesde(estado.url);
  if (!(await hayOSeRecupera(store, inject(SesionFacade)))) {
    return conVolver(router, RUTA_LOGIN, volver);
  }
  if (store.debeCambiarContrasena()) {
    return conVolver(router, RUTA_CONTRASENA_TEMPORAL, volver);
  }
  return true;
};

/**
 * «Elija su contraseña» (fuera del layout), solo con una contraseña temporal. Sin sesión, al login;
 * si ya no es temporal (la cambió en otra pestaña), a la pantalla que pedía.
 */
export const contrasenaTemporalGuard: CanActivateFn = async (ruta) => {
  const router = inject(Router);
  const store = inject(AuthStore);
  const volver = ruta.queryParamMap.get('volver');
  if (!(await hayOSeRecupera(store, inject(SesionFacade)))) {
    return conVolver(router, RUTA_LOGIN, volverDesde(volver ?? '/'));
  }
  if (!store.debeCambiarContrasena()) return router.parseUrl(destinoTrasIngreso(volver));
  return true;
};

/**
 * El login es solo para quien no tiene sesión: si ya la tiene (o se recupera con la cookie), va
 * directo a la pantalla que pedía (y, si su contraseña es temporal, `sesionGuard` lo lleva a
 * cambiarla).
 */
export const sinSesionGuard: CanActivateFn = async (ruta) => {
  const store = inject(AuthStore);
  const facade = inject(SesionFacade);
  const router = inject(Router);
  const destino = router.parseUrl(destinoTrasIngreso(ruta.queryParamMap.get('volver')));
  if (store.autenticado()) return destino;
  try {
    return (await facade.renovar(null)) === null ? true : destino;
  } catch {
    return true;
  }
};

/**
 * `true` si hay sesión en esta pestaña o se recupera con la cookie. Sin conexión, `false`: el
 * interceptor de errores ya avisó y la cookie sigue (al volver la red, entra sola).
 */
async function hayOSeRecupera(store: AuthStore, facade: SesionFacade): Promise<boolean> {
  if (store.autenticado()) return true;
  try {
    return (await facade.renovar(null)) !== null;
  } catch {
    return false;
  }
}

function conVolver(router: Router, ruta: string, volver: string | null): UrlTree {
  return router.createUrlTree([ruta], volver === null ? {} : { queryParams: { volver } });
}
