import { CodigoPermisoInvalidoError } from '../errors/auth.errors.js';

export const LARGO_MAXIMO_CODIGO_PERMISO = 100;

/** `modulo.recurso.accion`, en minúsculas, con `_` para separar palabras (`auth.usuario.ver`). */
const FORMATO = /^[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+$/u;

/**
 * El código de un permiso. No recorta ni pasa a minúsculas: lo escribe el código, y uno mal
 * escrito tiene que fallar, no corregirse en silencio. La base revisa el mismo formato.
 */
export class CodigoPermiso {
  private constructor(readonly valor: string) {}

  static crear(texto: string): CodigoPermiso {
    if (texto.length > LARGO_MAXIMO_CODIGO_PERMISO || !FORMATO.test(texto)) {
      throw new CodigoPermisoInvalidoError(texto);
    }
    return new CodigoPermiso(texto);
  }

  /** La primera parte: el módulo que lo declara. */
  get modulo(): string {
    return this.valor.slice(0, this.valor.indexOf('.'));
  }

  toString(): string {
    return this.valor;
  }

  toJSON(): string {
    return this.valor;
  }
}
