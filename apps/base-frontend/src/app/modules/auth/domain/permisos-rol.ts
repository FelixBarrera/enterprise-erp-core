/** Un permiso del catálogo (`GET /permisos`): el código que se asigna y lo que permite. */
export interface PermisoCatalogo {
  readonly codigo: string;
  readonly descripcion: string;
}

/** Los permisos de un módulo, con el título que declara el módulo («Usuarios y roles»). */
export interface GrupoPermisos {
  readonly modulo: string;
  readonly nombre: string;
  readonly permisos: readonly PermisoCatalogo[];
}

/** Lo que pasa con un permiso respecto de lo guardado. */
export type CambioPermiso = 'agrega' | 'quita' | null;

/** Cómo se ve la casilla de todo un grupo. */
export type MarcaGrupo = 'todo' | 'parcial' | 'ninguno';

/**
 * Para la escalada (AUTH-D11 (2)): `puedeDar(codigo)` dice si quien opera tiene ese permiso (el
 * administrador, todos). Quitar nunca da más poder: lo que el rol ya tenía se puede quitar y volver
 * a poner.
 */
export interface ReglaPermisos {
  readonly originales: ReadonlySet<string>;
  readonly puedeDar: (codigo: string) => boolean;
}

/** Todos los códigos del catálogo, en su orden. */
export function codigosDelCatalogo(catalogo: readonly GrupoPermisos[]): string[] {
  return catalogo.flatMap((g) => g.permisos.map((p) => p.codigo));
}

/** «8 de 12». */
export function textoMarcados(marcados: number, total: number): string {
  return `${marcados} de ${total}`;
}

/** Sin mayúsculas ni tildes, para buscar «contrasena» y encontrar «contraseña». */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function cambioDePermiso(
  codigo: string,
  marcados: ReadonlySet<string>,
  originales: ReadonlySet<string>,
): CambioPermiso {
  const marcado = marcados.has(codigo);
  if (marcado === originales.has(codigo)) return null;
  return marcado ? 'agrega' : 'quita';
}

/** Si la casilla se puede cambiar: lo que puede dar, o lo que el rol ya tenía. */
export function sePuedeCambiar(codigo: string, regla: ReglaPermisos): boolean {
  return regla.originales.has(codigo) || regla.puedeDar(codigo);
}

export function marcaDelGrupo(grupo: GrupoPermisos, marcados: ReadonlySet<string>): MarcaGrupo {
  const cuantos = grupo.permisos.filter((p) => marcados.has(p.codigo)).length;
  if (cuantos === 0) return 'ninguno';
  return cuantos === grupo.permisos.length ? 'todo' : 'parcial';
}

/**
 * «Marcar todo el grupo»: marca los que se pueden marcar; si ya no queda ninguno por marcar,
 * desmarca los que se pueden cambiar. Los demás grupos quedan igual.
 */
export function alternarGrupo(
  grupo: GrupoPermisos,
  marcados: ReadonlySet<string>,
  regla: ReglaPermisos,
): Set<string> {
  const cambiables = grupo.permisos
    .map((p) => p.codigo)
    .filter((codigo) => sePuedeCambiar(codigo, regla));
  const porMarcar = cambiables.filter((codigo) => !marcados.has(codigo));
  const resultado = new Set(marcados);
  if (porMarcar.length > 0) porMarcar.forEach((codigo) => resultado.add(codigo));
  else cambiables.forEach((codigo) => resultado.delete(codigo));
  return resultado;
}

/** Marca o desmarca uno (si no se puede cambiar, queda igual). */
export function alternarPermiso(
  codigo: string,
  marcados: ReadonlySet<string>,
  regla: ReglaPermisos,
): Set<string> {
  const resultado = new Set(marcados);
  if (!sePuedeCambiar(codigo, regla)) return resultado;
  if (resultado.has(codigo)) resultado.delete(codigo);
  else resultado.add(codigo);
  return resultado;
}

/** Cuántos permisos cambiaron (cada uno cuenta como un cambio en «N cambios sin guardar»). */
export function cantidadDeCambiosDePermisos(
  marcados: ReadonlySet<string>,
  originales: ReadonlySet<string>,
): number {
  let cambios = 0;
  for (const codigo of marcados) if (!originales.has(codigo)) cambios += 1;
  for (const codigo of originales) if (!marcados.has(codigo)) cambios += 1;
  return cambios;
}

export interface FiltroPermisos {
  readonly texto: string;
  readonly soloMarcados: boolean;
}

/**
 * Los grupos con los permisos que coinciden con el buscador (en la descripción, sin mayúsculas ni
 * tildes) y, si se pide, solo los marcados. Con un filtro puesto, los grupos que quedan vacíos no
 * se muestran. El grupo conserva todos sus permisos en `grupo` (para su «N de M» y su casilla).
 */
export function filtrarCatalogo(
  catalogo: readonly GrupoPermisos[],
  marcados: ReadonlySet<string>,
  filtro: FiltroPermisos,
): { readonly grupo: GrupoPermisos; readonly visibles: readonly PermisoCatalogo[] }[] {
  const texto = normalizarBusqueda(filtro.texto);
  const conFiltro = texto !== '' || filtro.soloMarcados;
  return catalogo
    .map((grupo) => ({
      grupo,
      visibles: grupo.permisos.filter(
        (p) =>
          (texto === '' || normalizarBusqueda(p.descripcion).includes(texto)) &&
          (!filtro.soloMarcados || marcados.has(p.codigo)),
      ),
    }))
    .filter((g) => !conFiltro || g.visibles.length > 0);
}

/** Lo que se manda al backend: los marcados, en el orden del catálogo. */
export function permisosEnOrden(
  catalogo: readonly GrupoPermisos[],
  marcados: ReadonlySet<string>,
): string[] {
  return codigosDelCatalogo(catalogo).filter((codigo) => marcados.has(codigo));
}
