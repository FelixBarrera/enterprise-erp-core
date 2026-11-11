import { inject, Injectable, Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  abrirDialogo,
  idUnico,
} from '../../../../../../shared/infrastructure/avisos/abrir-dialogo';
import type { DatosContrasenaTemporal } from './contrasena-temporal.component';

export interface OpcionesContrasenaTemporal {
  readonly titulo: string;
  readonly nombreUsuario: string;
  readonly contrasena: string;
  readonly textoListo: string;
}

/**
 * Muestra una contraseña temporal recién dada (AUTH-D13), con «Copiar». Se cierra solo con su
 * botón: ni Escape ni un clic afuera, para no perderla por un descuido (no se puede volver a ver).
 * El alta la usa al crear un usuario; el 6.12b3, al dar otra.
 *
 * Uso: `await this.contrasena.mostrar({ titulo, nombreUsuario, contrasena, textoListo });`
 */
@Injectable({ providedIn: 'root' })
export class ContrasenaTemporalService {
  private readonly injector = inject(Injector);

  /** Termina cuando se cierra. */
  async mostrar(opciones: OpcionesContrasenaTemporal): Promise<void> {
    const datos: DatosContrasenaTemporal = {
      ...opciones,
      idTitulo: idUnico('contrasena-temporal-titulo'),
      idTexto: idUnico('contrasena-temporal-texto'),
    };
    const ref = await abrirDialogo<void, DatosContrasenaTemporal, unknown>(
      this.injector,
      () => import('./contrasena-temporal.component').then((m) => m.ContrasenaTemporalComponent),
      {
        data: datos,
        ariaLabelledBy: datos.idTitulo,
        ariaDescribedBy: datos.idTexto,
        ariaModal: true,
        disableClose: true,
        // Si se va a otra pantalla (atrás del navegador), sigue a la vista hasta cerrarla.
        closeOnNavigation: false,
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
        panelClass: 'panel-aviso',
      },
    );
    await firstValueFrom(ref.closed);
  }
}
