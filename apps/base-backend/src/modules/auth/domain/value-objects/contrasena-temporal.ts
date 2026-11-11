/** Largo de la contraseña temporal (AUTH-D13). */
export const LARGO_CONTRASENA_TEMPORAL = 12;

/**
 * Las letras y los dígitos que se leen sin dudar, dictados o copiados a mano: sin `0`/`O` ni
 * `1`/`l`/`I` (AUTH-D13). 57 símbolos: 12 de ellos dan unos 70 bits al azar.
 */
export const ALFABETO_CONTRASENA_TEMPORAL =
  'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Arma una contraseña temporal con el azar que recibe: `elegir(n)` devuelve un entero de 0 a
 * `n - 1` (en el adaptador, `crypto.randomInt`, nunca `Math.random`). Pura: quien la usa la pasa
 * después por `Contrasena.crear()`, que rechaza la rara vez que salga común o trivial.
 */
export function armarContrasenaTemporal(elegir: (n: number) => number): string {
  let resultado = '';
  for (let i = 0; i < LARGO_CONTRASENA_TEMPORAL; i++) {
    resultado += ALFABETO_CONTRASENA_TEMPORAL.charAt(elegir(ALFABETO_CONTRASENA_TEMPORAL.length));
  }
  return resultado;
}
