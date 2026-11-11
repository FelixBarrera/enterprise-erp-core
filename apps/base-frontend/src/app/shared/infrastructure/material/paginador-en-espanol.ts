import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/** Los textos de `mat-paginator` en español (va en `PROVIDERS_MATERIAL`). */
@Injectable()
export class PaginadorEnEspanol extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Filas por página';
  override nextPageLabel = 'Página siguiente';
  override previousPageLabel = 'Página anterior';
  override firstPageLabel = 'Primera página';
  override lastPageLabel = 'Última página';

  /** «21 – 40 de 57»; sin filas, «0 de 0». */
  override getRangeLabel = (pagina: number, tamano: number, total: number): string => {
    if (total === 0 || tamano === 0) return `0 de ${total}`;
    const desde = pagina * tamano;
    const hasta = Math.min(desde + tamano, total);
    return `${desde + 1} – ${hasta} de ${total}`;
  };
}
