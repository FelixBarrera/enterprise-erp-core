import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MARCA } from './marca';

/**
 * El logo (provisional, docs/arquitectura-frontend.md, 8.6): el símbolo de tres barras que suben y
 * el nombre (`MARCA.logo`) con la fuente de la aplicación. `tono="claro"` sobre el azul oscuro (menú, login);
 * `tono="oscuro"` sobre fondo claro. El símbolo es decorativo: el nombre se lee como texto.
 * `[soloSimbolo]="true"`: sin el nombre (el menú estrecho); quien lo envuelve lleva su `aria-label`.
 */
@Component({
  selector: 'app-marca',
  template: `
    <svg aria-hidden="true" focusable="false" viewBox="0 0 40 40" class="marca__simbolo">
      @if (tono() === 'claro') {
        <rect
          width="40"
          height="40"
          rx="10"
          fill="#fff"
          fill-opacity="0.08"
          stroke="#fff"
          stroke-opacity="0.18"
        />
      } @else {
        <rect width="40" height="40" rx="10" class="marca__fondo" />
      }
      <rect x="10" y="22" width="5" height="9" rx="1.5" fill="#fff" />
      <rect x="17.5" y="16" width="5" height="15" rx="1.5" fill="#fff" />
      <rect x="25" y="9" width="5" height="22" rx="1.5" class="marca__barra" />
    </svg>
    <!-- El espacio no se ve (lo da el gap), pero el lector de pantalla lee el nombre completo. -->
    @if (!soloSimbolo()) {
      <span class="marca__nombre">{{ logo.nombre }}</span>
      @if (logo.sigla) {
        {{ ' ' }}<span class="marca__sigla">{{ logo.sigla }}</span>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--color-texto);
      line-height: 1;
      white-space: nowrap;
    }
    :host([tono='claro']) {
      color: var(--color-menu-texto);
    }
    .marca__simbolo {
      width: 30px;
      height: 30px;
      flex: none;
    }
    :host([tamano='grande']) .marca__simbolo {
      width: 40px;
      height: 40px;
    }
    .marca__fondo {
      fill: var(--color-menu);
    }
    .marca__barra {
      fill: var(--color-acento);
    }
    .marca__nombre {
      font-size: 19px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    :host([tamano='grande']) .marca__nombre {
      font-size: 24px;
    }
    .marca__sigla {
      color: var(--color-acento-texto);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.16em;
    }
    :host([tono='claro']) .marca__sigla {
      color: var(--color-acento);
    }
  `,
  host: { '[attr.tono]': 'tono()', '[attr.tamano]': 'tamano()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarcaComponent {
  readonly tono = input<'claro' | 'oscuro'>('oscuro');
  readonly tamano = input<'normal' | 'grande'>('normal');
  readonly soloSimbolo = input(false);

  protected readonly logo = MARCA.logo;
}
