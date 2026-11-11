import { Prisma } from '../../../generated/prisma/client.js';
import { Dinero } from '../../domain/value-objects/dinero.vo.js';

/**
 * De `Prisma.Decimal` (lo que entrega una columna `Decimal`) a `Dinero`. Solo en adaptadores:
 * el dominio y los casos de uso no conocen `Prisma.Decimal`.
 * Si la columna tiene más de 2 decimales con valor, falla (no redondea a escondidas).
 */
export function decimalADinero(valor: Prisma.Decimal): Dinero {
  // toFixed() sin argumento: todos los decimales y nunca notación científica (1e-7).
  return Dinero.desdeTexto(valor.toFixed());
}

/** De `Dinero` a `Prisma.Decimal`, para guardar en una columna `Decimal @db.Decimal(14, 2)`. */
export function dineroADecimal(monto: Dinero): Prisma.Decimal {
  return new Prisma.Decimal(monto.aTexto());
}
