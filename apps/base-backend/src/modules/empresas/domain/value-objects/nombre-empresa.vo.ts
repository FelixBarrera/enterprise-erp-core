import { NombreEmpresaInvalidoError } from '../errors/empresas.errors.js';

export const LARGO_MAXIMO_NOMBRE_EMPRESA = 150;

/**
 * El nombre de una empresa: lo que se ve en el selector y en la cabecera.
 * Se recorta, se juntan los espacios repetidos y se normaliza a NFC (una "é" escrita de dos
 * formas queda igual). Obligatorio, de 1 a 150 caracteres.
 */
export class NombreEmpresa {
  private constructor(readonly valor: string) {}

  static crear(texto: string): NombreEmpresa {
    const limpio = texto.normalize('NFC').replace(/\s+/gu, ' ').trim();
    if (limpio.length === 0) {
      throw new NombreEmpresaInvalidoError('El nombre de la empresa es obligatorio');
    }
    if (limpio.length > LARGO_MAXIMO_NOMBRE_EMPRESA) {
      throw new NombreEmpresaInvalidoError(
        `El nombre de la empresa no puede pasar de ${LARGO_MAXIMO_NOMBRE_EMPRESA} caracteres`,
      );
    }
    return new NombreEmpresa(limpio);
  }

  toString(): string {
    return this.valor;
  }

  toJSON(): string {
    return this.valor;
  }
}
