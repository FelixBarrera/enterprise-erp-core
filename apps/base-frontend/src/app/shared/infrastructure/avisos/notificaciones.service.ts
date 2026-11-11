import { inject, Injectable, Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { abrirDialogo, idUnico } from './abrir-dialogo';
import type { DatosAviso } from './aviso/aviso.component';

/** Lo que dura a la vista un aviso de éxito: 2,5 a 8 s según el largo del texto (regla 10). */
export function duracionAvisoExito(texto: string): number {
  return Math.min(8000, Math.max(2500, 1500 + texto.length * 60));
}

/**
 * Avisos globales en un modal pequeño (docs/arquitectura-frontend.md, regla 10):
 * el de éxito se cierra solo; el de error espera "Aceptar".
 *
 * Uso (en una pantalla o un facade): `await this.avisos.exito('Cliente registrado')`.
 * Los errores de red, 5xx y 403 ya los avisa el interceptor: no repetirlos.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly injector = inject(Injector);
  /** Textos de error a la vista: el mismo error de varias peticiones a la vez se avisa una vez. */
  private readonly erroresAbiertos = new Set<string>();

  /** Se resuelve cuando el aviso se cierra. */
  async exito(texto: string): Promise<void> {
    const ref = await this.abrir({ tipo: 'exito', texto, idTexto: idUnico('aviso-texto') });
    const temporizador = setTimeout(() => ref.close(), duracionAvisoExito(texto));
    await firstValueFrom(ref.closed);
    clearTimeout(temporizador);
  }

  /** Se resuelve cuando la persona pulsa "Aceptar" (o Escape). */
  async error(texto: string): Promise<void> {
    if (this.erroresAbiertos.has(texto)) return;
    this.erroresAbiertos.add(texto);
    try {
      const ref = await this.abrir({ tipo: 'error', texto, idTexto: idUnico('aviso-texto') });
      await firstValueFrom(ref.closed);
    } finally {
      this.erroresAbiertos.delete(texto);
    }
  }

  private abrir(datos: DatosAviso) {
    const esError = datos.tipo === 'error';
    return abrirDialogo<void, DatosAviso, unknown>(
      this.injector,
      () => import('./aviso/aviso.component').then((m) => m.AvisoComponent),
      {
        data: datos,
        role: esError ? 'alertdialog' : 'dialog',
        ariaLabel: esError ? 'Error' : 'Aviso',
        ariaDescribedBy: datos.idTexto,
        ariaModal: true,
        // El de error no se cierra con un clic afuera: hay que leerlo. Escape lo cierra el componente.
        disableClose: esError,
        autoFocus: esError ? 'first-tabbable' : 'dialog',
        maxWidth: 'calc(100vw - 32px)',
        width: '420px',
        panelClass: 'panel-aviso',
      },
    );
  }
}
