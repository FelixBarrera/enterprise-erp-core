import { InjectionToken } from '@angular/core';
import type { NombreIcono } from './icono/icono.component';

export interface OpcionMenu {
  readonly texto: string;
  /** Ruta del router (`/clientes`). */
  readonly ruta: string;
  readonly icono: NombreIcono;
  /**
   * El permiso `modulo.recurso.accion` que pide su pantalla (el mismo de su `permisoGuard`). Sin
   * él, la opción no se ve. Sin `permiso`, la ve todo el que tiene sesión (el inicio).
   */
  readonly permiso?: string;
}

export interface SeccionMenu {
  /** Fijo y único: con él se recuerda si la sección quedó abierta o cerrada. */
  readonly id: string;
  readonly titulo: string;
  readonly opciones: readonly OpcionMenu[];
}

/**
 * Las opciones del menú lateral. Las define `app.menu.ts` (shared/ no conoce los módulos) y las
 * entrega `app.config.ts`. El layout muestra solo las que permite la sesión (`menuVisible()`).
 */
export const MENU_APLICACION = new InjectionToken<readonly SeccionMenu[]>('MENU_APLICACION');

/**
 * Lo que se ve del menú: las opciones sin permiso o con uno que la persona tiene, y solo las
 * secciones a las que les queda alguna. Ocultar no es proteger: la ruta lleva su `permisoGuard`.
 */
export function menuVisible(
  secciones: readonly SeccionMenu[],
  tiene: (codigo: string) => boolean,
): readonly SeccionMenu[] {
  return secciones
    .map((seccion) => ({
      ...seccion,
      opciones: seccion.opciones.filter((o) => o.permiso === undefined || tiene(o.permiso)),
    }))
    .filter((seccion) => seccion.opciones.length > 0);
}
