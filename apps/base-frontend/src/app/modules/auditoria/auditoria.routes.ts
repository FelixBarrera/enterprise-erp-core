import type { Routes } from '@angular/router';
import { AUDITORIA_PROVIDERS } from './auditoria.providers';

/**
 * `/bitacora`: lo que se hizo en la empresa activa (con `auditoria.evento.ver`, en
 * `pantallas.routes.ts`); `?entidad=usuario&entidadId=…`, la historia de un registro. El detalle
 * de un evento, en `/bitacora/:id`.
 */
export const BITACORA_ROUTES: Routes = [
  {
    path: '',
    providers: AUDITORIA_PROVIDERS,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./infrastructure/adapters/in/bitacora/bitacora.component').then(
            (m) => m.BitacoraComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./infrastructure/adapters/in/detalle-evento/detalle-evento.component').then(
            (m) => m.DetalleEventoComponent,
          ),
      },
    ],
  },
];
