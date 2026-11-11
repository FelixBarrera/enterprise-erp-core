import type { ParamMap, Params } from '@angular/router';
import { type PedidoPagina, TAMANO_PAGINA_POR_DEFECTO, TAMANOS_PAGINA } from '../../domain/pagina';

/**
 * Piezas para el `filtros-url.ts` de cada lista (docs/arquitectura-frontend.md, sección 4): leer
 * un filtro de la URL ignorando lo que no se entiende y escribir solo lo que no es el valor
 * inicial.
 */

/** Un texto recortado; sin él, `''`. */
export function textoDeUrl(parametros: ParamMap, nombre: string): string {
  return parametros.get(nombre)?.trim() ?? '';
}

/**
 * `true` o `false`; cualquier otra cosa (o nada), el valor inicial. Para «Todos / Sí / No», mejor
 * `opcionDeUrl()` con tres textos.
 */
export function booleanoDeUrl(parametros: ParamMap, nombre: string, inicial: boolean): boolean {
  const valor = parametros.get(nombre);
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return inicial;
}

/** Uno de los valores permitidos; otro (o nada), el inicial. */
export function opcionDeUrl<T extends string>(
  parametros: ParamMap,
  nombre: string,
  permitidos: readonly T[],
  inicial: T,
): T {
  const valor = parametros.get(nombre);
  return permitidos.find((p) => p === valor) ?? inicial;
}

const ENTERO = /^[1-9]\d{0,5}$/u;

/** `?pagina=2&tamano=50`. Una página que no es un entero positivo, la 1; un tamaño que no se ofrece, 20. */
export function paginaDeUrl(parametros: ParamMap): PedidoPagina {
  const pagina = parametros.get('pagina') ?? '';
  const tamano = Number(parametros.get('tamano'));
  return {
    pagina: ENTERO.test(pagina) ? Number(pagina) : 1,
    tamano: TAMANOS_PAGINA.includes(tamano) ? tamano : TAMANO_PAGINA_POR_DEFECTO,
  };
}

/** La página para la URL: sin `pagina=1` ni `tamano=20` (los valores iniciales no se escriben). */
export function paginaAUrl(pedido: PedidoPagina): Params {
  const parametros: Params = {};
  if (pedido.pagina !== 1) parametros['pagina'] = String(pedido.pagina);
  if (pedido.tamano !== TAMANO_PAGINA_POR_DEFECTO) parametros['tamano'] = String(pedido.tamano);
  return parametros;
}

/**
 * Un filtro para la URL: si es el valor inicial (o un texto vacío), no se escribe. Uso, en el
 * `filtrosAUrl()` de cada lista:
 * `{ ...filtroAUrl('buscar', f.buscar, ''), ...filtroAUrl('activo', f.activo, true) }`.
 */
export function filtroAUrl(
  nombre: string,
  valor: string | boolean,
  inicial: string | boolean,
): Params {
  const texto = typeof valor === 'string' ? valor.trim() : valor;
  if (texto === inicial || texto === '') return {};
  return { [nombre]: String(texto) };
}
