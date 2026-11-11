import type { DeclaracionDeModulo } from '../../../domain/services/catalogo-permisos.js';

export const CATALOGO_PERMISOS_PORT = Symbol('CATALOGO_PERMISOS_PORT');

/** Lo que declara un módulo en su `<modulo>.permisos.ts`: código → descripción. */
export type DeclaracionPermisos = DeclaracionDeModulo;

/**
 * Los permisos que declara el código (`src/catalogo-permisos.ts`). El módulo lo entrega con este
 * token: así el caso de uso no conoce los demás módulos y las pruebas pasan el suyo.
 */
export type CatalogoPermisosDeclarado = readonly DeclaracionPermisos[];
