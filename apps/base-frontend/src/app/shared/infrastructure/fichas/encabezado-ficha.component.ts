import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IconoComponent } from '../layout/icono/icono.component';

/**
 * El encabezado de una ficha o de un alta (docs/arquitectura-frontend.md, 8.2 y 8.5): la flecha
 * para volver, el símbolo (iniciales o ícono), el nombre con su estado, una línea debajo y, a la
 * derecha, las acciones (la que quita algo, con borde rojo).
 *
 * Un botón de `fichaAcciones` dentro de un `@if` tiene que ser **el único elemento** de ese `@if`:
 * con dos `@if` anidados, Angular no lo coloca en su lugar y no aparece.
 *
 * «Volver» regresa a la lista **como estaba** (con sus filtros y su página) si se llegó desde ella;
 * si se abrió el enlace directo, va a `volverA`.
 *
 * ```html
 * <app-encabezado-ficha titulo="Jefe de oficina" volverA="/roles" textoVolver="Roles">
 *   <span fichaSimbolo class="iniciales iniciales--grande" aria-hidden="true">JO</span>
 *   <span fichaEstado class="estado estado--exito">Activo</span>
 *   <span fichaDetalle>2 usuarios activos tienen este rol</span>
 *   <button fichaAcciones matButton="outlined" class="boton-peligro">Desactivar</button>
 * </app-encabezado-ficha>
 * ```
 */
@Component({
  selector: 'app-encabezado-ficha',
  imports: [IconoComponent],
  template: `
    <header class="encabezado-ficha" [class.encabezado-ficha--en-linea]="accionesEnLinea()">
      <div class="encabezado-ficha__principal">
        <button
          type="button"
          class="encabezado-ficha__volver"
          [attr.aria-label]="'Volver a ' + textoVolver()"
          (click)="volver()"
        >
          <app-icono nombre="volver" [tamano]="22" />
        </button>
        <ng-content select="[fichaSimbolo]" />
        <div class="encabezado-ficha__textos">
          <div class="encabezado-ficha__titulo">
            <h1 class="titulo-pagina">{{ titulo() }}</h1>
            <ng-content select="[fichaEstado]" />
          </div>
          <div class="encabezado-ficha__detalle"><ng-content select="[fichaDetalle]" /></div>
        </div>
      </div>
      <div class="encabezado-ficha__acciones"><ng-content select="[fichaAcciones]" /></div>
    </header>
  `,
  styles: `
    .encabezado-ficha {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }

    .encabezado-ficha__principal {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .encabezado-ficha__volver {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      margin-left: -10px;
      border: 0;
      border-radius: var(--radio);
      background: none;
      color: var(--color-texto);
      cursor: pointer;

      &:hover {
        background: var(--color-fila-hover);
      }
    }

    .encabezado-ficha__textos {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .encabezado-ficha__titulo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;

      .titulo-pagina {
        margin: 0;
        overflow-wrap: anywhere;
      }
    }

    .encabezado-ficha__detalle {
      color: var(--color-texto-secundario);

      &:empty {
        display: none;
      }
    }

    // Una acción de solo ícono («⋮» en el celular): se queda a la derecha, sin bajar de renglón.
    .encabezado-ficha--en-linea {
      flex-wrap: nowrap;

      .encabezado-ficha__principal {
        flex: 1;
      }
    }

    .encabezado-ficha__acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      &:empty {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EncabezadoFichaComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** El nombre del registro («Jefe de oficina») o el del alta («Nuevo rol»). */
  readonly titulo = input.required<string>();
  /** La lista, si no se llegó desde ella: `/roles`. */
  readonly volverA = input.required<string>();
  /** Para el lector de pantalla: «Volver a Roles». */
  readonly textoVolver = input.required<string>();
  /** Las acciones son un solo botón de ícono: van a la derecha del nombre, nunca debajo. */
  readonly accionesEnLinea = input(false);

  protected volver(): void {
    const anterior = this.router.lastSuccessfulNavigation()?.previousNavigation?.finalUrl;
    const desde = anterior === undefined ? null : this.router.serializeUrl(anterior);
    if (desde !== null && desde.split(/[?#]/u)[0] === this.volverA()) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl(this.volverA());
  }
}
