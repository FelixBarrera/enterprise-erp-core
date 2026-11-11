import { Clipboard } from '@angular/cdk/clipboard';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';

export interface DatosContrasenaTemporal {
  /** «Usuario creado» o, en el 6.12b3, «Contraseña temporal nueva». */
  readonly titulo: string;
  readonly nombreUsuario: string;
  readonly contrasena: string;
  /** El botón que cierra: «Listo, ir a su ficha». */
  readonly textoListo: string;
  readonly idTitulo: string;
  readonly idTexto: string;
}

type Copia = 'sin-copiar' | 'copiada' | 'fallo';

/**
 * La ventana de `ContrasenaTemporalService`: la contraseña temporal (AUTH-D13) con «Copiar» y el
 * aviso de que se ve esta sola vez. No se usa directo.
 */
@Component({
  selector: 'app-contrasena-temporal',
  imports: [IconoComponent],
  template: `
    <div class="contrasena-temporal__cabecera">
      <span class="contrasena-temporal__marca" aria-hidden="true">
        <app-icono nombre="listo" [tamano]="22" />
      </span>
      <h2 class="contrasena-temporal__titulo" [id]="datos.idTitulo">{{ datos.titulo }}</h2>
    </div>
    <p class="contrasena-temporal__texto" [id]="datos.idTexto">
      Esta es la contraseña temporal de <strong>{{ datos.nombreUsuario }}</strong
      >. Entréguesela en persona. Al entrar, el sistema le pedirá que la cambie.
    </p>

    <div class="contrasena-temporal__campo">
      <span class="contrasena-temporal__etiqueta" id="contrasena-temporal-etiqueta">
        Contraseña temporal
      </span>
      <div class="contrasena-temporal__caja">
        <output
          class="contrasena-temporal__valor"
          aria-labelledby="contrasena-temporal-etiqueta"
          translate="no"
          >{{ datos.contrasena }}</output
        >
        <button
          type="button"
          class="boton boton--secundario contrasena-temporal__copiar"
          [class.contrasena-temporal__copiar--hecho]="copia() === 'copiada'"
          (click)="copiar()"
        >
          <app-icono [nombre]="copia() === 'copiada' ? 'listo' : 'copiar'" [tamano]="18" />
          {{ copia() === 'copiada' ? 'Copiada' : 'Copiar' }}
        </button>
      </div>
      <span
        role="status"
        class="contrasena-temporal__estado"
        [class.contrasena-temporal__estado--fallo]="copia() === 'fallo'"
      >
        @switch (copia()) {
          @case ('copiada') {
            Copiada. Péguela donde la vaya a entregar.
          }
          @case ('fallo') {
            No se pudo copiar. Selecciónela y cópiela a mano.
          }
        }
      </span>
    </div>

    <p class="contrasena-temporal__aviso">
      <app-icono nombre="alerta" [tamano]="18" />
      <span>
        Se muestra <strong>esta sola vez</strong>. Al cerrar ya no se puede volver a ver: si se
        pierde, hay que dar otra.
      </span>
    </p>

    <div class="contrasena-temporal__acciones">
      <button type="button" class="boton boton--primario" (click)="cerrar()">
        {{ datos.textoListo }}
      </button>
    </div>
  `,
  styleUrl: './contrasena-temporal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContrasenaTemporalComponent {
  protected readonly datos = inject<DatosContrasenaTemporal>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly portapapeles = inject(Clipboard);

  protected readonly copia = signal<Copia>('sin-copiar');

  protected copiar(): void {
    this.copia.set(this.portapapeles.copy(this.datos.contrasena) ? 'copiada' : 'fallo');
  }

  protected cerrar(): void {
    this.ref.close();
  }
}
