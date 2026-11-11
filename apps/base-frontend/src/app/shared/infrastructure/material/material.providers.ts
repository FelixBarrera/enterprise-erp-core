import type { Provider } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { ErrorAlTocar } from './error-al-tocar';
import { PaginadorEnEspanol } from './paginador-en-espanol';

/**
 * Opciones por defecto de Material para todas las pantallas. Van en la ruta lazy de las pantallas
 * (`pantallas.routes.ts`), nunca en `app.config.ts`: con solo importar aquí un token de Material,
 * su componente entero pasa al paquete inicial en cuanto una pantalla lo usa (se midió: +60 kB).
 */
export const PROVIDERS_MATERIAL: Provider[] = [
  // Campos con borde, y la ayuda o el error ocupando solo el alto que necesitan
  // (docs/arquitectura-frontend.md, 8.5).
  {
    provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
    useValue: { appearance: 'outline', subscriptSizing: 'dynamic' },
  },
  // El error de un campo se ve si está mal y se tocó (al enviar se tocan todos).
  { provide: ErrorStateMatcher, useClass: ErrorAlTocar },
  // «Filas por página», «1 – 20 de 57».
  { provide: MatPaginatorIntl, useClass: PaginadorEnEspanol },
];
