/**
 * Hasta dos letras para el círculo de una persona o una empresa: la primera de la primera palabra
 * y la de la última («Ana María Pérez» → «AP»; «Comercial Ejemplo» → «CE»). Sin letras, `?`.
 */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/u)
    .filter((palabra) => /\p{L}|\p{N}/u.test(palabra));
  if (palabras.length === 0) return '?';
  const primera = primeraLetra(palabras[0]);
  if (palabras.length === 1) return primera;
  return primera + primeraLetra(palabras[palabras.length - 1]);
}

function primeraLetra(palabra: string): string {
  const letra = /[\p{L}\p{N}]/u.exec(palabra)?.[0] ?? '';
  return letra.toLocaleUpperCase('es');
}
