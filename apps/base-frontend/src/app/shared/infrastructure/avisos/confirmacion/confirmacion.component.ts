import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

export interface DatosConfirmacion {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  peligro: boolean;
  idTitulo: string;
  idMensaje: string;
  idCancelar: string;
}

/** La ventana de `ConfirmacionService`. No se usa directo. */
@Component({
  selector: 'app-confirmacion',
  templateUrl: './confirmacion.component.html',
  styleUrl: './confirmacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmacionComponent {
  protected readonly datos = inject<DatosConfirmacion>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected responder(confirmado: boolean): void {
    this.ref.close(confirmado);
  }
}
