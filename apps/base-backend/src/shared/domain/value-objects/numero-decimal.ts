/**
 * Ayudas para hacer cuentas con decimales exactos usando enteros grandes (`bigint`), sin
 * librerías y sin los errores de `number` (0.1 + 0.2 = 0.30000000000000004).
 * Uso interno de `Dinero`; no se exporta fuera de `shared/domain/value-objects/`.
 */

/** Un decimal escrito como entero: `valor / 10^escala` (por ejemplo `12.345` = 12345 / 10^3). */
export interface NumeroDecimal {
  valor: bigint;
  escala: number;
}

// Solo dígitos, con signo menos opcional y punto decimal: nada de `1e5`, `+1`, `.5`, `1.` ni comas.
const PATRON = /^(-)?(\d+)(?:\.(\d+))?$/;
// Para que nadie mande un número de miles de cifras.
const LARGO_MAXIMO = 40;

/** `null` si el texto no es un decimal válido. */
export function leerDecimal(texto: string): NumeroDecimal | null {
  if (texto.length > LARGO_MAXIMO) {
    return null;
  }
  const partes = PATRON.exec(texto);
  if (!partes) {
    return null;
  }
  const [, signo, entera = '', decimales = ''] = partes;
  const valor = BigInt(entera + decimales);
  return { valor: signo ? -valor : valor, escala: decimales.length };
}

export function potenciaDeDiez(exponente: number): bigint {
  return 10n ** BigInt(exponente);
}

/**
 * División entera redondeando "mitad hacia arriba" (0,5 se aleja del cero: 2,5 → 3 y
 * -2,5 → -3), el redondeo que usa el SRI. El divisor es siempre positivo.
 */
export function dividirRedondeando(numerador: bigint, divisor: bigint): bigint {
  const negativo = numerador < 0n;
  const absoluto = negativo ? -numerador : numerador;
  let cociente = absoluto / divisor;
  if ((absoluto % divisor) * 2n >= divisor) {
    cociente += 1n;
  }
  return negativo ? -cociente : cociente;
}
