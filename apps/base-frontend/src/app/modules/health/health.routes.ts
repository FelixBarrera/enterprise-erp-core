import type { Routes } from '@angular/router';
import { HEALTH_PROVIDERS } from './health.providers';

export const HEALTH_ROUTES: Routes = [
  {
    path: '',
    providers: HEALTH_PROVIDERS,
    loadComponent: () =>
      import('./infrastructure/adapters/in/estado-servicio/estado-servicio.component').then(
        (m) => m.EstadoServicioComponent,
      ),
  },
];
