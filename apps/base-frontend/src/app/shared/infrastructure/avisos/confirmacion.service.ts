import { inject, Injectable, Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { abrirDialogo, idUnico } from './abrir-dialogo';
import type { DatosConfirmacion } from './confirmacion/confirmacion.component';

export interface OpcionesConfirmacion {
  /** Pregunta corta: "¿Desactivar el cliente?". */
  titulo: string;
  /** Qué pasa si se confirma, en una o dos frases. */
  mensaje: string;
  /** Texto del botón que confirma: lo que hace ("Desactivar"), no "Sí". */
  textoConfirmar: string;
  /** `true` si quita algo: el botón va en rojo. */
  peligro?: boolean;
}

/**
 * Pregunta antes de hacer algo (lo que quita algo se confirma siempre, sección 8.2).
 * El foco empieza en "Cancelar": un Enter apurado no confirma.
 *
 * Uso: `if (!(await this.confirmacion.confirmar({ … }))) return;`
 */
@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  private readonly injector = inject(Injector);

  /** `true` solo si se pulsó el botón de confirmar; Cancelar, Escape o un clic afuera: `false`. */
  async confirmar(opciones: OpcionesConfirmacion): Promise<boolean> {
    const datos: DatosConfirmacion = {
      ...opciones,
      peligro: opciones.peligro ?? false,
      idTitulo: idUnico('confirmacion-titulo'),
      idMensaje: idUnico('confirmacion-mensaje'),
      idCancelar: idUnico('confirmacion-cancelar'),
    };
    const ref = await abrirDialogo<boolean, DatosConfirmacion, unknown>(
      this.injector,
      () => import('./confirmacion/confirmacion.component').then((m) => m.ConfirmacionComponent),
      {
        data: datos,
        role: 'alertdialog',
        ariaLabelledBy: datos.idTitulo,
        ariaDescribedBy: datos.idMensaje,
        ariaModal: true,
        autoFocus: `#${datos.idCancelar}`,
        maxWidth: 'calc(100vw - 32px)',
        width: '460px',
        panelClass: 'panel-aviso',
      },
    );
    return (await firstValueFrom(ref.closed)) === true;
  }
}
