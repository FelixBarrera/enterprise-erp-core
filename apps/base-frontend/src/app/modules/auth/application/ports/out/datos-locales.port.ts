import { InjectionToken } from '@angular/core';

/**
 * Lo que el navegador guardó de la API (las lecturas que guarda el service worker). Se borra al
 * salir y al cambiar de empresa: nada de una sesión queda a la vista en la otra.
 */
export interface DatosLocalesPort {
  /** Nunca lanza: si no se puede borrar, sigue (la página se recarga igual). */
  borrar(): Promise<void>;
}

export const DATOS_LOCALES_PORT = new InjectionToken<DatosLocalesPort>('DATOS_LOCALES_PORT');
