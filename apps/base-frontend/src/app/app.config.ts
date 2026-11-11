import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { MENU } from './app.menu';
import { routes } from './app.routes';
import { AUTH_PROVIDERS } from './modules/auth/auth.providers';
import { sesionInterceptor } from './modules/auth/infrastructure/adapters/in/http/sesion.interceptor';
import { erroresInterceptor } from './shared/infrastructure/http/errores.interceptor';
import { MENU_APLICACION } from './shared/infrastructure/layout/menu';
import { ActualizacionesService } from './shared/infrastructure/pwa/actualizaciones.service';

// Solo providers livianos: lo de cada módulo va en su ruta lazy (presupuesto del paquete inicial).
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // El de sesión va antes que el de errores: recibe el 401 ya traducido y lo resuelve.
    provideHttpClient(withFetch(), withInterceptors([sesionInterceptor, erroresInterceptor])),
    ...AUTH_PROVIDERS,
    provideRouter(routes),
    { provide: MENU_APLICACION, useValue: MENU },
    // PWA: el service worker solo en producción (en desarrollo y pruebas, `isDevMode()` es true).
    // Se registra cuando la aplicación queda estable o, a más tardar, a los 30 s.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => inject(ActualizacionesService).iniciar()),
  ],
};
