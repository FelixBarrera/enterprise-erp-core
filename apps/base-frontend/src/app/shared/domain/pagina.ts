/**
 * Una página de un listado, tal como la manda el backend (`Pagina<T>` de
 * `apps/base-backend/src/shared/application/pagina.ts`).
 */
export interface Pagina<T> {
  readonly elementos: readonly T[];
  /** Cuántos hay en total con los mismos filtros. */
  readonly total: number;
  /** Desde 1. */
  readonly pagina: number;
  readonly tamano: number;
}

/** Qué página pedir (desde 1) y de cuántos elementos. */
export interface PedidoPagina {
  readonly pagina: number;
  readonly tamano: number;
}

/** Los tamaños que se pueden elegir; el del medio es el de siempre (y el del backend). */
export const TAMANOS_PAGINA: readonly number[] = [10, 20, 50, 100];
export const TAMANO_PAGINA_POR_DEFECTO = 20;

/** La última página con elementos (1 si no hay ninguno). */
export function ultimaPagina(total: number, tamano: number): number {
  return Math.max(1, Math.ceil(total / tamano));
}
