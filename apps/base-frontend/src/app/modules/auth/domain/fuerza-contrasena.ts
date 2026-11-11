/** Largo que acepta el backend para una contraseña nueva (`Contrasena` del backend). */
export const LARGO_MINIMO_CONTRASENA = 8;
export const LARGO_MAXIMO_CONTRASENA = 128;

/** De 0 (vacía) a 4 (muy buena): cuántas rayitas de la barra se pintan. */
export type NivelFuerza = 0 | 1 | 2 | 3 | 4;

export interface FuerzaContrasena {
  readonly nivel: NivelFuerza;
  readonly texto: string;
}

const TEXTOS: Record<NivelFuerza, string> = {
  0: `Escriba al menos ${LARGO_MINIMO_CONTRASENA} caracteres`,
  1: 'Muy corta',
  2: 'Aceptable: más larga es más segura',
  3: 'Buena',
  4: 'Muy buena',
};

/**
 * Una guía mientras se escribe, **solo por el largo** (lo que más pesa en una contraseña). No
 * decide nada: si es común, trivial o contiene el usuario o la empresa lo revisa el backend al
 * guardar (el frontend valida la forma; el backend, las reglas).
 */
export function fuerzaContrasena(texto: string): FuerzaContrasena {
  const largo = texto.length;
  const nivel: NivelFuerza =
    largo === 0 ? 0 : largo < LARGO_MINIMO_CONTRASENA ? 1 : largo < 12 ? 2 : largo < 16 ? 3 : 4;
  return { nivel, texto: TEXTOS[nivel] };
}

/** Tiene el largo que acepta el backend. */
export function largoDeContrasenaValido(texto: string): boolean {
  return texto.length >= LARGO_MINIMO_CONTRASENA && texto.length <= LARGO_MAXIMO_CONTRASENA;
}
