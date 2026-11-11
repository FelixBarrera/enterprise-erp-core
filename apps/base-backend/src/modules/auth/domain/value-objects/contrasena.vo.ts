import { ContrasenaDebilError } from '../errors/auth.errors.js';

export const LARGO_MINIMO_CONTRASENA = 8;
export const LARGO_MAXIMO_CONTRASENA = 128;

/** Lo que una contraseña nueva no puede contener ni ser (lo arma quien la pide). */
export interface ContextoContrasena {
  /** Con lo que entra el usuario (ya en minúsculas). */
  readonly nombreUsuario: string;
  /** Las empresas en las que trabaja (o la que se está creando). */
  readonly nombresEmpresas: readonly string[];
  /** Si está en la lista de contraseñas comunes (`CONTRASENAS_COMUNES_PORT`). */
  readonly esComun: (contrasena: string) => boolean;
}

/** Las filas del teclado y los dígitos, para rechazar "qwertyui" o "asdfghjk". */
const TECLADO = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
/** Palabras del nombre de la empresa que cuentan por sí solas ("valores" en "Valores del Sur"). */
const LARGO_MINIMO_PALABRA_EMPRESA = 5;
/** Un trozo que se repite: "abab…", "abcabc…", "abcdabcd…". */
const PERIODO_MAXIMO_REPETICION = 4;

/**
 * Normaliza lo que se escribe como contraseña: NFKC, para que la misma contraseña escrita en
 * dos teclados (o con letras de ancho completo) dé el mismo hash. **No se recorta**: un espacio
 * es parte de la contraseña. La usan también el login y el cambio de contraseña al verificar.
 */
export function normalizarContrasena(texto: string): string {
  return texto.normalize('NFKC');
}

/**
 * Una contraseña nueva que cumple las reglas (docs/arquitectura-backend.md, sección 14):
 * de 8 a 128 caracteres, sin reglas de composición ("una mayúscula"), y no puede ser común,
 * trivial (repeticiones, secuencias, filas del teclado) ni contener el nombre de usuario o el
 * de alguna de sus empresas. Nunca se muestra: en el log o en un JSON sale `[OCULTO]`.
 */
export class Contrasena {
  private constructor(readonly valor: string) {}

  static crear(texto: string, contexto: ContextoContrasena): Contrasena {
    const valor = normalizarContrasena(texto);
    // Por carácter (un emoji cuenta uno), no por unidad de UTF-16.
    const largo = Array.from(valor).length;
    if (largo < LARGO_MINIMO_CONTRASENA) {
      throw new ContrasenaDebilError(
        `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres`,
      );
    }
    if (largo > LARGO_MAXIMO_CONTRASENA) {
      throw new ContrasenaDebilError(
        `La contraseña no puede pasar de ${LARGO_MAXIMO_CONTRASENA} caracteres`,
      );
    }
    if (contexto.esComun(valor.toLowerCase())) {
      throw new ContrasenaDebilError('La contraseña es demasiado común');
    }
    if (esTrivial(valor.toLowerCase())) {
      throw new ContrasenaDebilError(
        'La contraseña es demasiado fácil de adivinar (repeticiones, secuencias o filas del teclado)',
      );
    }
    const comparable = soloLetrasYNumeros(valor);
    if (contiene(comparable, contexto.nombreUsuario, 3)) {
      throw new ContrasenaDebilError('La contraseña no puede contener su nombre de usuario');
    }
    if (contexto.nombresEmpresas.some((nombre) => contieneEmpresa(comparable, nombre))) {
      throw new ContrasenaDebilError('La contraseña no puede contener el nombre de la empresa');
    }
    return new Contrasena(valor);
  }

  toString(): string {
    return '[OCULTO]';
  }

  toJSON(): string {
    return '[OCULTO]';
  }
}

/** Minúsculas, sin tildes y sin nada que no sea letra o número: "Juan.Pérez" → "juanperez". */
function soloLetrasYNumeros(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function contiene(comparable: string, texto: string, largoMinimo: number): boolean {
  const buscado = soloLetrasYNumeros(texto);
  return buscado.length >= largoMinimo && comparable.includes(buscado);
}

/** El nombre entero de la empresa, o una de sus palabras largas. */
function contieneEmpresa(comparable: string, nombre: string): boolean {
  return (
    contiene(comparable, nombre, LARGO_MINIMO_PALABRA_EMPRESA) ||
    nombre
      .split(/\s+/u)
      .some((palabra) => contiene(comparable, palabra, LARGO_MINIMO_PALABRA_EMPRESA))
  );
}

function esTrivial(minusculas: string): boolean {
  return esRepeticion(minusculas) || esSecuencia(minusculas) || esDelTeclado(minusculas);
}

/** Un trozo corto repetido de principio a fin: "aaaaaaaa", "abababab", "abcdabcd". */
function esRepeticion(texto: string): boolean {
  const caracteres = Array.from(texto);
  for (let periodo = 1; periodo <= PERIODO_MAXIMO_REPETICION; periodo++) {
    if (caracteres.every((caracter, i) => caracter === caracteres[i % periodo])) {
      return true;
    }
  }
  return false;
}

/** Caracteres seguidos hacia arriba o hacia abajo: "12345678", "abcdefgh", "87654321". */
function esSecuencia(texto: string): boolean {
  const codigos = Array.from(texto, (caracter) => caracter.codePointAt(0) ?? 0);
  const paso = (codigos[1] ?? 0) - (codigos[0] ?? 0);
  return (
    Math.abs(paso) === 1 &&
    codigos.every((codigo, i) => i === 0 || codigo - (codigos[i - 1] ?? 0) === paso)
  );
}

/** Un trozo de una fila del teclado, hacia un lado o hacia el otro: "qwertyui", "lkjhgfds". */
function esDelTeclado(texto: string): boolean {
  return TECLADO.some(
    (fila) => fila.includes(texto) || Array.from(fila).reverse().join('').includes(texto),
  );
}
