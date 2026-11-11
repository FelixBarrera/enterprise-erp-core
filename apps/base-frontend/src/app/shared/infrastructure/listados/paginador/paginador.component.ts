import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatPaginator, type PageEvent } from '@angular/material/paginator';
import { TAMANOS_PAGINA } from '../../../domain/pagina';
import { CELULAR, segunPantalla } from '../../layout/pantalla-chica';
import type { Listado } from '../listado';

/**
 * El paginador de una lista (`mat-paginator` en español, `PaginadorEnEspanol`), conectado a la URL
 * por el listado. En el celular, sin «Filas por página». No se ve mientras no llega la primera
 * página ni si la lista está vacía.
 *
 * Uso, al pie de la tarjeta de la tabla: `<app-paginador [listado]="listado" />`.
 */
@Component({
  selector: 'app-paginador',
  imports: [MatPaginator],
  template: `
    @if (resultado(); as pagina) {
      <mat-paginator
        [length]="pagina.total"
        [pageIndex]="pagina.pagina - 1"
        [pageSize]="pagina.tamano"
        [pageSizeOptions]="tamanos"
        [hidePageSize]="enCelular()"
        [disabled]="listado().cargando()"
        (page)="cambiar($event)"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginadorComponent {
  readonly listado = input.required<Listado<unknown, unknown>>();

  protected readonly tamanos = TAMANOS_PAGINA;
  protected readonly enCelular = segunPantalla(CELULAR);
  protected readonly resultado = computed(() => {
    const pagina = this.listado().resultado();
    return pagina === null || pagina.total === 0 ? null : pagina;
  });

  protected cambiar(evento: PageEvent): void {
    this.listado().irAPagina({ pagina: evento.pageIndex + 1, tamano: evento.pageSize });
  }
}
