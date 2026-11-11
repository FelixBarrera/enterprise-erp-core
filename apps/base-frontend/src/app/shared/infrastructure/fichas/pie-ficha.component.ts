import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FechaHoraPipe } from '../fechas/fecha-hora.pipe';

/** Cuándo y quién (de la bitácora). `por: null`: lo hizo el sistema. */
export interface Huella {
  readonly en: string;
  readonly por: string | null;
}

/**
 * El pie de una ficha: «Creado el 02/11/2026 10:15 por ana.perez» y «Modificado el … por …», en la
 * zona del negocio. Lo que no llegó (`null`) no se muestra; sin ninguno de los dos, nada.
 *
 * Uso: `<app-pie-ficha [creado]="rol.creado" [modificado]="rol.modificado" />`; en la ficha de un
 * usuario, `textoCreado="Con acceso desde el"`. Un enlace a la derecha («Ver historia»), con el
 * atributo `pieAccion`: `<a pieAccion class="enlace pie-ficha__enlace" …>Ver historia</a>`.
 */
@Component({
  selector: 'app-pie-ficha',
  imports: [FechaHoraPipe],
  // Sin nada que mostrar, el pie vacío no se ve (`.pie-ficha:empty`, en styles.scss).
  template: `
    <footer class="pie-ficha">
      @if (creado(); as huella) {
        <span>
          {{ textoCreado() }} <span class="numero">{{ huella.en | fechaHora }}</span> por
          {{ huella.por ?? 'el sistema' }}
        </span>
      }
      @if (modificado(); as huella) {
        <span>
          Modificado el <span class="numero">{{ huella.en | fechaHora }}</span> por
          {{ huella.por ?? 'el sistema' }}
        </span>
      }
      <ng-content select="[pieAccion]" />
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PieFichaComponent {
  readonly creado = input.required<Huella | null>();
  readonly modificado = input.required<Huella | null>();
  readonly textoCreado = input('Creado el');
}
