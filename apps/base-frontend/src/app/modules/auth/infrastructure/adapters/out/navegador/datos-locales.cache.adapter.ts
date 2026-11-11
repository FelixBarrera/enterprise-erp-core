import { Injectable } from '@angular/core';
import type { DatosLocalesPort } from '../../../../application/ports/out/datos-locales.port';

/**
 * Borra las lecturas de la API que guardó el service worker (sus cachés de datos llevan `:data:`
 * en el nombre). El código de la aplicación queda: así sigue abriendo sin conexión.
 */
@Injectable()
export class DatosLocalesCacheAdapter implements DatosLocalesPort {
  async borrar(): Promise<void> {
    try {
      if (typeof caches === 'undefined') return;
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.includes(':data:')).map((n) => caches.delete(n)));
    } catch {
      // Sin permiso o sin almacenamiento: la página se recarga igual y la sesión ya se cerró.
    }
  }
}
