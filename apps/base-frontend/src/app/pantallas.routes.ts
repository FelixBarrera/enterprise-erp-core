import type { Routes } from '@angular/router';
import { PROVIDERS_MATERIAL } from './shared/infrastructure/material/material.providers';
import { permisoGuard } from './shared/infrastructure/permisos/permiso.guard';

// Las pantallas que van dentro del layout. Este archivo se descarga aparte (lazy): así lo común de
// Material no pesa en el arranque. Cada módulo entra con su propia ruta lazy.
export const PANTALLAS_ROUTES: Routes = [
  {
    path: '',
    providers: PROVIDERS_MATERIAL,
    children: [
      {
        path: 'cambiar-contrasena',
        loadChildren: () =>
          import('./modules/auth/auth.routes').then((m) => m.CAMBIAR_CONTRASENA_ROUTES),
      },
      {
        path: 'usuarios',
        canMatch: [permisoGuard('auth.usuario.ver')],
        data: { miga: 'Usuarios' },
        loadChildren: () =>
          import('./modules/auth/administracion.routes').then((m) => m.USUARIOS_ROUTES),
      },
      {
        path: 'roles',
        canMatch: [permisoGuard('auth.rol.ver')],
        data: { miga: 'Roles' },
        loadChildren: () =>
          import('./modules/auth/administracion.routes').then((m) => m.ROLES_ROUTES),
      },
      {
        path: 'bitacora',
        canMatch: [permisoGuard('auditoria.evento.ver')],
        data: { miga: 'Bitácora' },
        loadChildren: () =>
          import('./modules/auditoria/auditoria.routes').then((m) => m.BITACORA_ROUTES),
      },
      {
        // Provisional: el inicio muestra el estado del servicio.
        path: '',
        loadChildren: () => import('./modules/health/health.routes').then((m) => m.HEALTH_ROUTES),
      },
    ],
  },
];
