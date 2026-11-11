import type { Params } from '@angular/router';
import type { RegistroBitacora } from '../../../domain/registro';
import { tieneHistoria } from '../../../domain/registro';

/** Una pantalla a la que se puede ir desde la bitácora. */
export interface Enlace {
  readonly ruta: readonly string[];
  readonly parametros?: Params;
}

/** Las fichas que se abren desde la bitácora: la ruta y el permiso que pide (`pantallas.routes.ts`). */
const FICHAS: Readonly<
  Record<string, { readonly permiso: string; readonly ruta: (id: string) => readonly string[] }>
> = {
  usuario: { permiso: 'auth.usuario.ver', ruta: (id) => ['/usuarios', id] },
  rol: { permiso: 'auth.rol.ver', ruta: (id) => ['/roles', id] },
};

/**
 * «Ver su ficha»: la del usuario o el rol, si quien mira tiene el permiso de esa pantalla. Una
 * sesión y la empresa no tienen ficha (`null`; la empresa se renombra por comando, 6.15b).
 */
export function fichaDelRegistro(
  entidad: string | null,
  entidadId: string | null,
  tiene: (permiso: string) => boolean,
): Enlace | null {
  if (entidad === null || entidadId === null) return null;
  const ficha = FICHAS[entidad] as (typeof FICHAS)[string] | undefined;
  if (ficha === undefined || !tiene(ficha.permiso)) return null;
  return { ruta: ficha.ruta(entidadId) };
}

/** «Ver su historia»: la bitácora de ese registro, sin fechas (solo usuarios y roles). */
export function historiaDelRegistro(
  entidad: string | null,
  entidadId: string | null,
): Enlace | null {
  if (entidad === null || entidadId === null || !tieneHistoria(entidad)) return null;
  const registro: RegistroBitacora = { entidad, entidadId };
  return { ruta: ['/bitacora'], parametros: { ...registro } };
}
