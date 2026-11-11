import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

/**
 * Lleva a una dirección **recargando la página**: así no queda nada de la sesión anterior en la
 * memoria (docs/arquitectura-frontend.md, sección 6). Aparte, para poder probarlo.
 */
@Injectable({ providedIn: 'root' })
export class Recarga {
  private readonly documento = inject(DOCUMENT);

  ir(ruta: string): void {
    this.documento.location.assign(ruta);
  }
}
