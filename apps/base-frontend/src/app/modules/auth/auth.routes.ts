import type { Routes } from '@angular/router';
import { PROVIDERS_MATERIAL } from '../../shared/infrastructure/material/material.providers';
import {
  contrasenaTemporalGuard,
  sinSesionGuard,
} from './infrastructure/adapters/in/guards/sesion.guard';
import type { DatosRutaCambiarContrasena } from './infrastructure/adapters/in/cambiar-contrasena/cambiar-contrasena.component';

const cargarCambiarContrasena = () =>
  import('./infrastructure/adapters/in/cambiar-contrasena/cambiar-contrasena.component').then(
    (m) => m.CambiarContrasenaComponent,
  );

/** El login, fuera del layout. Se descarga aparte (con las opciones de Material). */
export const AUTH_ROUTES: Routes = [
  {
    path: '',
    providers: PROVIDERS_MATERIAL,
    canActivate: [sinSesionGuard],
    loadComponent: () =>
      import('./infrastructure/adapters/in/login/login.component').then((m) => m.LoginComponent),
  },
];

/** «Elija su contraseña» (la temporal, AUTH-D14): fuera del layout, sin menú. */
export const CONTRASENA_TEMPORAL_ROUTES: Routes = [
  {
    path: '',
    providers: PROVIDERS_MATERIAL,
    canActivate: [contrasenaTemporalGuard],
    data: { temporal: true } satisfies DatosRutaCambiarContrasena,
    loadComponent: cargarCambiarContrasena,
  },
];

/** «Cambiar contraseña» (la voluntaria): dentro del layout, que ya pide la sesión. */
export const CAMBIAR_CONTRASENA_ROUTES: Routes = [
  {
    path: '',
    data: { temporal: false } satisfies DatosRutaCambiarContrasena,
    loadComponent: cargarCambiarContrasena,
  },
];
