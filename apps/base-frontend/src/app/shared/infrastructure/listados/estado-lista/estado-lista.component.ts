import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { TipoErrorHttp } from '../../../domain/errors/error-http';
import { IconoComponent } from '../../layout/icono/icono.component';
import type { Listado } from '../listado';

/** Errores que se arreglan volviendo a intentar (la red, el servidor). Los 4xx, no. */
const SE_REINTENTA: readonly TipoErrorHttp[] = [
  TipoErrorHttp.SIN_CONEXION,
  TipoErrorHttp.SERVIDOR_NO_DISPONIBLE,
  TipoErrorHttp.ERROR_SERVIDOR,
  TipoErrorHttp.DEMASIADAS_PETICIONES,
];

/**
 * Lo que se ve en lugar de las filas cuando no hay ninguna (docs/arquitectura-frontend.md, 4):
 * - **Error**: el mensaje del backend (un 400 de un filtro) o, si ya lo avisó el interceptor (sin
 *   conexión, 5xx), «No se pudo cargar la lista»; con «Reintentar» si es de la red o del servidor.
 * - **Vacío**: el texto de la lista y, si hay filtros, «Limpiar filtros».
 * - Mientras carga la primera vez, nada (la barra de arriba ya lo dice).
 *
 * Uso, debajo de la tabla o de las tarjetas:
 * `<app-estado-lista [listado]="listado" vacio="No hay roles" vacioConFiltros="Ningún rol coincide con los filtros" />`.
 */
@Component({
  selector: 'app-estado-lista',
  imports: [MatButton, IconoComponent],
  template: `
    @if (listado().error(); as error) {
      <div class="estado-lista" role="alert">
        <app-icono nombre="alerta" class="estado-lista__icono estado-lista__icono--error" />
        <p class="estado-lista__texto">
          {{ error.avisado ? 'No se pudo cargar la lista.' : error.message }}
        </p>
        @if (seReintenta()) {
          <button matButton="outlined" type="button" (click)="listado().reintentar()">
            Reintentar
          </button>
        }
      </div>
    } @else if (vacia()) {
      <div class="estado-lista">
        <app-icono nombre="informacion" class="estado-lista__icono" />
        @if (listado().filtrosActivos() > 0) {
          <p class="estado-lista__texto">{{ vacioConFiltros() }}</p>
          <button matButton="outlined" type="button" (click)="listado().limpiarFiltros()">
            Limpiar filtros
          </button>
        } @else {
          <p class="estado-lista__texto">{{ vacio() }}</p>
        }
      </div>
    }
  `,
  styles: `
    .estado-lista {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 20px;
      text-align: center;
    }

    .estado-lista__icono {
      color: var(--color-texto-tenue);

      &--error {
        color: var(--estado-peligro);
      }
    }

    .estado-lista__texto {
      margin: 0;
      color: var(--color-texto-secundario);
      font-size: 15px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoListaComponent {
  readonly listado = input.required<Listado<unknown, unknown>>();
  /** «No hay roles». */
  readonly vacio = input.required<string>();
  /** «Ningún rol coincide con los filtros». */
  readonly vacioConFiltros = input('Nada coincide con los filtros.');

  protected readonly vacia = computed(() => {
    const resultado = this.listado().resultado();
    return resultado !== null && resultado.elementos.length === 0;
  });

  protected readonly seReintenta = computed(() => {
    const error = this.listado().error();
    return error !== null && SE_REINTENTA.includes(error.tipo);
  });
}
