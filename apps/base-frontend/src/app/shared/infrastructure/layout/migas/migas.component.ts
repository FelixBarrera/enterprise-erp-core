import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconoComponent } from '../icono/icono.component';
import type { Miga } from './migas';

/** «Administración › Roles › Jefe de oficina», en la cabecera (en la PC). */
@Component({
  selector: 'app-migas',
  imports: [RouterLink, IconoComponent],
  template: `
    <nav aria-label="Ruta" class="migas">
      <ol class="migas__lista">
        @for (miga of migas(); track $index; let ultima = $last) {
          <li class="migas__paso">
            @if (ultima) {
              <span class="migas__actual" aria-current="page">{{ miga.texto }}</span>
            } @else if (miga.url !== null) {
              <a class="migas__enlace" [routerLink]="miga.url">{{ miga.texto }}</a>
            } @else {
              <span>{{ miga.texto }}</span>
            }
            @if (!ultima) {
              <app-icono nombre="siguiente" class="migas__separador" [tamano]="14" />
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .migas__lista {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--color-texto-secundario);
      white-space: nowrap;
    }

    .migas__paso {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .migas__enlace {
      border-radius: 4px;
      color: inherit;
      text-decoration: none;

      &:hover {
        color: var(--color-primario);
        text-decoration: underline;
      }
    }

    .migas__actual {
      overflow: hidden;
      color: var(--color-texto);
      font-weight: 600;
      text-overflow: ellipsis;
    }

    .migas__separador {
      flex: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MigasComponent {
  readonly migas = input.required<readonly Miga[]>();
}
