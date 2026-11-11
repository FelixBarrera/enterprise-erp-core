import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

export interface DatosAviso {
  tipo: 'exito' | 'error';
  texto: string;
  /** Id del párrafo, para `aria-describedby`. */
  idTexto: string;
}

/** El modal pequeño de `NotificacionesService`. No se usa directo. */
@Component({
  selector: 'app-aviso',
  templateUrl: './aviso.component.html',
  styleUrl: './aviso.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.aviso--error]': 'datos.tipo === "error"',
    '(keydown.escape)': 'cerrar()',
  },
})
export class AvisoComponent {
  protected readonly datos = inject<DatosAviso>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<void>>(DialogRef);

  protected cerrar(): void {
    this.ref.close();
  }
}
