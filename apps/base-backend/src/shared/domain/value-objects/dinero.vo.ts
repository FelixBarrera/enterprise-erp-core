import { MontoInvalidoError } from '../errors/valores.errors.js';
import {
  dividirRedondeando,
  leerDecimal,
  type NumeroDecimal,
  potenciaDeDiez,
} from './numero-decimal.js';

const DECIMALES = 2;
const CENTAVOS_POR_DOLAR = potenciaDeDiez(DECIMALES);
// Factores (cantidades, precios, tasas) con más decimales que esto no tienen sentido.
const DECIMALES_MAXIMOS_FACTOR = 12;

/**
 * Un monto en dólares (la moneda de Ecuador), exacto al centavo (regla 10: nunca `number`).
 *
 * Por dentro son centavos en un entero grande (`bigint`), así las sumas nunca pierden un
 * centavo. Las multiplicaciones (por una cantidad, un precio o un porcentaje) redondean al
 * centavo "mitad hacia arriba" (0,005 → 0,01), como el SRI.
 *
 * - Desde la API o la base: `Dinero.desdeTexto('1234.56')` (como texto, nunca como número).
 * - Con la base: columna `Decimal @db.Decimal(14, 2)`; el adaptador convierte con
 *   `decimalADinero()` y `dineroADecimal()` (`shared/infrastructure/prisma/`).
 * - En el JSON de la API sale como texto: `'1234.56'`. El frontend lo muestra, no lo recalcula.
 * - Puede ser negativo (un ajuste, una diferencia): la regla de cada documento dice si se permite.
 */
export class Dinero {
  private constructor(private readonly centavos: bigint) {}

  static cero(): Dinero {
    return new Dinero(0n);
  }

  static desdeCentavos(centavos: bigint): Dinero {
    return new Dinero(centavos);
  }

  /** Desde un texto como `'1234.56'`, `'10'` o `'-0.5'` (con punto y hasta 2 decimales). */
  static desdeTexto(texto: string): Dinero {
    const numero = leerDecimal(texto);
    if (!numero) {
      throw new MontoInvalidoError();
    }
    if (numero.escala > DECIMALES) {
      throw new MontoInvalidoError('El monto no puede tener más de 2 decimales');
    }
    return new Dinero(numero.valor * potenciaDeDiez(DECIMALES - numero.escala));
  }

  /** La suma de varios montos (cero si la lista está vacía). */
  static total(montos: readonly Dinero[]): Dinero {
    return montos.reduce((acumulado, monto) => acumulado.sumar(monto), Dinero.cero());
  }

  sumar(otro: Dinero): Dinero {
    return new Dinero(this.centavos + otro.centavos);
  }

  restar(otro: Dinero): Dinero {
    return new Dinero(this.centavos - otro.centavos);
  }

  /**
   * Por una cantidad o un precio escrito como texto (`'1500'`, `'0.998750'`), redondeado al
   * centavo. Texto y no `number`, para no perder decimales antes de empezar.
   */
  multiplicar(factor: string): Dinero {
    const numero = Dinero.leerFactor(factor);
    return new Dinero(
      dividirRedondeando(this.centavos * numero.valor, potenciaDeDiez(numero.escala)),
    );
  }

  /** El porcentaje de este monto: `'15'` o `'15.0000'` = 15 %, redondeado al centavo. */
  porcentaje(tasa: string): Dinero {
    const numero = Dinero.leerFactor(tasa);
    return new Dinero(
      dividirRedondeando(this.centavos * numero.valor, potenciaDeDiez(numero.escala + 2)),
    );
  }

  esCero(): boolean {
    return this.centavos === 0n;
  }

  esPositivo(): boolean {
    return this.centavos > 0n;
  }

  esNegativo(): boolean {
    return this.centavos < 0n;
  }

  /** -1 si es menor, 0 si es igual, 1 si es mayor. */
  compararCon(otro: Dinero): -1 | 0 | 1 {
    return this.centavos < otro.centavos ? -1 : this.centavos > otro.centavos ? 1 : 0;
  }

  esIgualA(otro: Dinero): boolean {
    return this.centavos === otro.centavos;
  }

  esMayorQue(otro: Dinero): boolean {
    return this.centavos > otro.centavos;
  }

  esMenorQue(otro: Dinero): boolean {
    return this.centavos < otro.centavos;
  }

  aCentavos(): bigint {
    return this.centavos;
  }

  /** Siempre con 2 decimales y punto: `'1234.56'`, `'-0.50'`, `'0.00'`. */
  aTexto(): string {
    const negativo = this.centavos < 0n;
    const absoluto = negativo ? -this.centavos : this.centavos;
    const dolares = absoluto / CENTAVOS_POR_DOLAR;
    const centavos = String(absoluto % CENTAVOS_POR_DOLAR).padStart(DECIMALES, '0');
    return `${negativo ? '-' : ''}${dolares}.${centavos}`;
  }

  /** Así sale en el JSON de la API (como texto, para no perder precisión en el camino). */
  toJSON(): string {
    return this.aTexto();
  }

  toString(): string {
    return this.aTexto();
  }

  private static leerFactor(texto: string): NumeroDecimal {
    const numero = leerDecimal(texto);
    if (!numero || numero.escala > DECIMALES_MAXIMOS_FACTOR) {
      throw new MontoInvalidoError('El factor no es un número decimal válido');
    }
    return numero;
  }
}
