import type { SeccionMenu } from '../menu';

/** Un paso de la ruta que se ve en la cabecera: «Administración › Roles › Jefe de oficina». */
export interface Miga {
  readonly texto: string;
  /** A dónde lleva; `null` en la sección (no es una pantalla) y en la pantalla actual. */
  readonly url: string | null;
}

/** Un nivel de la ruta activa que dice su nombre (`data: { miga: 'Roles' }`). */
export interface NivelConMiga {
  readonly texto: string;
  readonly url: string;
}

function dentroDe(url: string, ruta: string): boolean {
  const camino = url.split(/[?#]/u)[0] ?? '';
  return camino === ruta || camino.startsWith(`${ruta}/`);
}

/**
 * Las migas de una pantalla: la sección del menú en la que está su opción (sin enlace), los niveles
 * de la ruta que dicen su nombre y, al final, el del registro abierto (lo pone la ficha). La última
 * es la pantalla actual: sin enlace. El inicio no tiene migas.
 */
export function armarMigas(
  menu: readonly SeccionMenu[],
  url: string,
  niveles: readonly NivelConMiga[],
  actual: string | null,
): readonly Miga[] {
  if (niveles.length === 0) return [];
  const seccion = menu.find((s) => s.opciones.some((o) => o.ruta !== '/' && dentroDe(url, o.ruta)));
  const migas: Miga[] = [
    ...(seccion === undefined ? [] : [{ texto: seccion.titulo, url: null }]),
    ...niveles.map((n) => ({ texto: n.texto, url: n.url })),
    ...(actual === null || actual.trim() === '' ? [] : [{ texto: actual, url: null }]),
  ];
  const ultima = migas.at(-1);
  if (ultima !== undefined) migas[migas.length - 1] = { texto: ultima.texto, url: null };
  return migas;
}
