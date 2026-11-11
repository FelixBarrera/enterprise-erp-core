import { NombreUsuarioInvalidoError } from '../errors/auth.errors.js';

const FORMATO = /^[a-z0-9._-]{3,50}$/u;

/**
 * Con lo que el usuario entra (AUTH-D3). Se recorta y se pasa a minúsculas: `Juan.Perez` y
 * `juan.perez` son el mismo. De 3 a 50 caracteres: letras sin tildes, números, `.`, `_` y `-`.
 * Único en toda la instalación y nunca se reutiliza (lo cuida la base).
 */
export class NombreUsuario {
  private constructor(readonly valor: string) {}

  static crear(texto: string): NombreUsuario {
    const limpio = texto.trim().toLowerCase();
    if (limpio.length === 0) {
      throw new NombreUsuarioInvalidoError('El nombre de usuario es obligatorio');
    }
    if (!FORMATO.test(limpio)) {
      throw new NombreUsuarioInvalidoError(
        'El nombre de usuario debe tener de 3 a 50 caracteres: letras sin tildes ni ñ, números, punto, guion o guion bajo',
      );
    }
    return new NombreUsuario(limpio);
  }

  toString(): string {
    return this.valor;
  }

  toJSON(): string {
    return this.valor;
  }
}
