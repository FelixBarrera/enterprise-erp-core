/**
 * Listados paginados (docs/arquitectura-backend.md, sección 9). El controller recibe un DTO que
 * extiende `PaginacionQueryDto`, pasa `{ pagina, tamano }` al caso de uso y responde la `Pagina`.
 */
export const TAMANO_PAGINA_POR_DEFECTO = 20;
export const TAMANO_PAGINA_MAXIMO = 100;
/** Un tope para que nadie pida la página mil millones (el `OFFSET` no cabría en un número). */
export const PAGINA_MAXIMA = 1_000_000;

/** Qué página quiere ver (desde 1) y de cuántos elementos. */
export interface PedidoPagina {
  readonly pagina: number;
  readonly tamano: number;
}

/** Una página de un listado: sus elementos y cuántos hay en total con los mismos filtros. */
export interface Pagina<T> {
  readonly elementos: readonly T[];
  readonly total: number;
  readonly pagina: number;
  readonly tamano: number;
}

/** Cuántos elementos saltar antes de esta página (el `skip` del repositorio). */
export function desplazamiento(pedido: PedidoPagina): number {
  return (pedido.pagina - 1) * pedido.tamano;
}

/** Arma la página con lo que devolvió el repositorio. */
export function crearPagina<T>(
  elementos: readonly T[],
  total: number,
  pedido: PedidoPagina,
): Pagina<T> {
  return { elementos, total, pagina: pedido.pagina, tamano: pedido.tamano };
}

/** La misma página con cada elemento convertido (por ejemplo, de entidad a vista). */
export function mapearPagina<T, R>(pagina: Pagina<T>, convertir: (elemento: T) => R): Pagina<R> {
  return { ...pagina, elementos: pagina.elementos.map(convertir) };
}
