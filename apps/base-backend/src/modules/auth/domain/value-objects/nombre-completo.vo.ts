import { NombreCompletoInvalidoError } from '../errors/auth.errors.js';
import { textoLimpio } from './texto-limpio.js';

export const LARGO_MAXIMO_NOMBRE_COMPLETO = 150;

/**
 * El nombre de la persona: lo que se ve en la cabecera, en las listas y en la bitácora.
 * Recortado, con los espacios juntados y en NFC. Obligatorio, de 1 a 150 caracteres.
 */
export class NombreCompleto {
  private constructor(readonly valor: string) {}

  static crear(texto: string): NombreCompleto {
    const limpio = textoLimpio(texto);
    if (limpio.length === 0) {
      throw new NombreCompletoInvalidoError('El nombre completo es obligatorio');
    }
    if (limpio.length > LARGO_MAXIMO_NOMBRE_COMPLETO) {
      throw new NombreCompletoInvalidoError(
        `El nombre completo no puede pasar de ${LARGO_MAXIMO_NOMBRE_COMPLETO} caracteres`,
      );
    }
    return new NombreCompleto(limpio);
  }

  toString(): string {
    return this.valor;
  }

  toJSON(): string {
    return this.valor;
  }
}
