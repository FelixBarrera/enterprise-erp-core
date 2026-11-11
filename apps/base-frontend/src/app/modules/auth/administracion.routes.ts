import type { Routes } from '@angular/router';
import { permisoGuard } from '../../shared/infrastructure/permisos/permiso.guard';
import { ADMINISTRACION_PROVIDERS } from './administracion.providers';

/** `/roles` (con `auth.rol.ver`, en `pantallas.routes.ts`): la lista, el alta y la ficha. */
export const ROLES_ROUTES: Routes = [
  {
    path: '',
    providers: ADMINISTRACION_PROVIDERS,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./infrastructure/adapters/in/lista-roles/lista-roles.component').then(
            (m) => m.ListaRolesComponent,
          ),
      },
      {
        // Antes de `:id`, para que «nuevo» no se lea como un id.
        path: 'nuevo',
        canMatch: [permisoGuard('auth.rol.crear')],
        loadComponent: () =>
          import('./infrastructure/adapters/in/nuevo-rol/nuevo-rol.component').then(
            (m) => m.NuevoRolComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./infrastructure/adapters/in/ficha-rol/ficha-rol.component').then(
            (m) => m.FichaRolComponent,
          ),
      },
    ],
  },
];

/** `/usuarios` (con `auth.usuario.ver`, en `pantallas.routes.ts`): la lista, el alta y la ficha. */
export const USUARIOS_ROUTES: Routes = [
  {
    path: '',
    providers: ADMINISTRACION_PROVIDERS,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./infrastructure/adapters/in/lista-usuarios/lista-usuarios.component').then(
            (m) => m.ListaUsuariosComponent,
          ),
      },
      {
        // Antes de `:id`, para que «nuevo» no se lea como un id.
        path: 'nuevo',
        canMatch: [permisoGuard('auth.usuario.crear')],
        loadComponent: () =>
          import('./infrastructure/adapters/in/nuevo-usuario/nuevo-usuario.component').then(
            (m) => m.NuevoUsuarioComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./infrastructure/adapters/in/ficha-usuario/ficha-usuario.component').then(
            (m) => m.FichaUsuarioComponent,
          ),
      },
    ],
  },
];
