import type { Routes } from '@angular/router';
import { sesionGuard } from './modules/auth/infrastructure/adapters/in/guards/sesion.guard';
import { LayoutComponent } from './shared/infrastructure/layout/layout.component';

// El login y «Elija su contraseña» (la temporal) van fuera del layout y se descargan aparte. El layout (cabecera, menú y pie) llega en el
// arranque y pide sesión; sus pantallas, en `pantallas.routes.ts` (lazy).
export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./modules/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'contrasena-temporal',
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.CONTRASENA_TEMPORAL_ROUTES),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [sesionGuard],
    canActivateChild: [sesionGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./pantallas.routes').then((m) => m.PANTALLAS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
