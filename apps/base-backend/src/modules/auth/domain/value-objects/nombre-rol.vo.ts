import { NombreRolInvalidoError } from '../errors/auth.errors.js';
import { textoLimpio } from './texto-limpio.js';

export const LARGO_MAXIMO_NOMBRE_ROL = 80;
export const LARGO_MAXIMO_DESCRIPCION_ROL = 250;

/** El nombre del rol del Administrador de cada empresa (AUTH-D10). */
export const NOMBRE_ROL_ADMINISTRADOR = 'Administrador';

/**
 * El nombre de un rol: lo que se ve al asignar roles. Recortado, con los espacios juntados y en
 * NFC. Obligatorio, de 1 a 80 caracteres. Único entre los activos de la empresa (lo cuida la base).
 */
export class NombreRol {
  private constructor(readonly valor: string) {}

  static crear(texto: string): NombreRol {
    const limpio = textoLimpio(texto);
    if (limpio.length === 0) {
      throw new NombreRolInvalidoError('El nombre del rol es obligatorio');
    }
    if (limpio.length > LARGO_MAXIMO_NOMBRE_ROL) {
      throw new NombreRolInvalidoError(
        `El nombre del rol no puede pasar de ${LARGO_MAXIMO_NOMBRE_ROL} caracteres`,
      );
    }
    return new NombreRol(limpio);
  }

  toString(): string {
    return this.valor;
  }

  toJSON(): string {
    return this.valor;
  }
}

/** La descripción de un rol (opcional): vacía o solo espacios = `null`; hasta 250 caracteres. */
export function descripcionRol(texto: string | null): string | null {
  if (texto === null) {
    return null;
  }
  const limpio = textoLimpio(texto);
  if (limpio.length === 0) {
    return null;
  }
  if (limpio.length > LARGO_MAXIMO_DESCRIPCION_ROL) {
    throw new NombreRolInvalidoError(
      `La descripción del rol no puede pasar de ${LARGO_MAXIMO_DESCRIPCION_ROL} caracteres`,
    );
  }
  return limpio;
}
