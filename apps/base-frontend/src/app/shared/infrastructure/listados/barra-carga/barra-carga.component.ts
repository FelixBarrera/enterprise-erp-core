import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';

/**
 * La barra de progreso arriba de una lista, pestaña o ficha, **con su alto reservado**: aparezca o
 * no, nada salta (docs/arquitectura-frontend.md, 8.3). El contenedor de lo que carga lleva
 * `[attr.aria-busy]="cargando()"`.
 *
 * Uso: `<app-barra-carga [activa]="listado.cargando()" />`.
 */
@Component({
  selector: 'app-barra-carga',
  imports: [MatProgressBar],
  template: `
    @if (activa()) {
      <mat-progress-bar mode="indeterminate" [attr.aria-label]="etiqueta()" />
    }
  `,
  styles: `
    :host {
      display: block;
      height: 4px;
      overflow: hidden;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraCargaComponent {
  readonly activa = input.required<boolean>();
  /** Para el lector de pantalla. */
  readonly etiqueta = input('Cargando');
}
