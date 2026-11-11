import { Prisma } from '../../../generated/prisma/client.js';
import { Dinero } from '../../domain/value-objects/dinero.vo.js';
import { decimalADinero, dineroADecimal } from './conversiones.js';

describe('conversiones de Prisma', () => {
  it('Decimal → Dinero', () => {
    expect(decimalADinero(new Prisma.Decimal('1234.5')).aTexto()).toBe('1234.50');
    expect(decimalADinero(new Prisma.Decimal('-0.01')).aTexto()).toBe('-0.01');
  });

  it('Decimal muy chico (que se escribiría 1e-7) con más de 2 decimales: falla, no redondea', () => {
    expect(() => decimalADinero(new Prisma.Decimal('0.0000001'))).toThrow(
      'El monto no puede tener más de 2 decimales',
    );
  });

  it('Dinero → Decimal', () => {
    expect(dineroADecimal(Dinero.desdeTexto('99.9')).toFixed(2)).toBe('99.90');
  });
});
