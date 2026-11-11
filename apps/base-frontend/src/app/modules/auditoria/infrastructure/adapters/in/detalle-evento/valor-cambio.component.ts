import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FechaHoraPipe } from '../../../../../../shared/infrastructure/fechas/fecha-hora.pipe';
import type { ValorMostrado } from '../../../../domain/cambios';

/**
 * Un lado de «Qué cambió»: un texto («Sin dato» y «Oculto» en gris), un instante en la zona del
 * negocio o una lista de etiquetas, con lo que se agregó en verde y «+» y lo que se quitó tachado
 * en rojo (el lector de pantalla oye «Se agregó» / «Se quitó»: no depende del color).
 */
@Component({
  selector: 'app-valor-cambio',
  imports: [FechaHoraPipe],
  template: `
    @let v = valor();
    @switch (v.tipo) {
      @case ('texto') {
        <span [class.valor-cambio__tenue]="v.tenue">{{ v.texto }}</span>
      }
      @case ('instante') {
        <span class="numero">{{ v.iso | fechaHora }}</span>
      }
      @case ('lista') {
        <span class="valor-cambio__lista">
          @for (elemento of v.elementos; track $index) {
            <span
              class="valor-cambio__etiqueta"
              [class.valor-cambio__etiqueta--agrega]="elemento.cambio === 'agrega'"
              [class.valor-cambio__etiqueta--quita]="elemento.cambio === 'quita'"
            >
              @switch (elemento.cambio) {
                @case ('agrega') {
                  <span aria-hidden="true">+</span><span class="oculto-visual">Se agregó: </span>
                }
                @case ('quita') {
                  <span class="oculto-visual">Se quitó: </span>
                }
              }
              {{ elemento.texto }}
            </span>
          }
        </span>
      }
    }
  `,
  styles: `
    .valor-cambio__tenue {
      color: var(--color-texto-secundario);
    }

    .valor-cambio__lista {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .valor-cambio__etiqueta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 24px;
      padding: 0 10px;
      border-radius: 999px;
      background: var(--estado-neutro-fondo);
      color: var(--estado-neutro);
      font-size: 14px;
      font-weight: 600;

      &--agrega {
        background: var(--estado-exito-fondo);
        color: var(--estado-exito);
      }

      &--quita {
        background: var(--estado-peligro-fondo);
        color: var(--estado-peligro);
        text-decoration: line-through;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValorCambioComponent {
  readonly valor = input.required<ValorMostrado>();
}
