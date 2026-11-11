import { MontoInvalidoError } from '../errors/valores.errors.js';
import { Dinero } from './dinero.vo.js';

const d = (texto: string): Dinero => Dinero.desdeTexto(texto);

describe('Dinero', () => {
  describe('desdeTexto', () => {
    it.each([
      ['1234.56', '1234.56'],
      ['10', '10.00'],
      ['0.5', '0.50'],
      ['-0.5', '-0.50'],
      ['-0', '0.00'],
      ['007.10', '7.10'],
      ['99999999999999999999.99', '99999999999999999999.99'],
    ])('lee "%s" como %s', (texto, esperado) => {
      expect(d(texto).aTexto()).toBe(esperado);
    });

    it.each(['', 'abc', '1,50', '1e5', '+1', '.5', '1.', ' 1', '1 ', '1.2.3', 'NaN', '-'])(
      'rechaza "%s"',
      (texto) => {
        expect(() => d(texto)).toThrow(MontoInvalidoError);
        expect(() => d(texto)).toThrow('El monto no es válido');
      },
    );

    it('rechaza más de 2 decimales (no redondea a escondidas)', () => {
      expect(() => d('1.005')).toThrow('El monto no puede tener más de 2 decimales');
    });

    it('rechaza un texto absurdamente largo', () => {
      expect(() => d('9'.repeat(41))).toThrow(MontoInvalidoError);
    });
  });

  it('suma sin perder centavos (con number, 0.1 + 0.2 da 0.30000000000000004)', () => {
    expect(d('0.1').sumar(d('0.2')).aTexto()).toBe('0.30');
    expect(Dinero.total(Array.from({ length: 1000 }, () => d('0.01'))).aTexto()).toBe('10.00');
    expect(Dinero.total([]).aTexto()).toBe('0.00');
  });

  it('resta y puede quedar negativo', () => {
    expect(d('10').restar(d('10.01')).aTexto()).toBe('-0.01');
  });

  describe('multiplicar (cantidad o precio como texto)', () => {
    it('multiplica exacto cuando no hace falta redondear', () => {
      expect(d('12.50').multiplicar('3').aTexto()).toBe('37.50');
      expect(d('1000').multiplicar('0.998750').aTexto()).toBe('998.75');
    });

    it('redondea al centavo mitad hacia arriba', () => {
      expect(d('0.10').multiplicar('0.05').aTexto()).toBe('0.01'); // 0.005 → 0.01
      expect(d('0.10').multiplicar('0.04').aTexto()).toBe('0.00'); // 0.004 → 0.00
      expect(d('1.00').multiplicar('1.234999').aTexto()).toBe('1.23');
    });

    it('con negativos, la mitad se aleja del cero', () => {
      expect(d('-0.10').multiplicar('0.05').aTexto()).toBe('-0.01');
      expect(d('0.10').multiplicar('-0.05').aTexto()).toBe('-0.01');
    });

    it.each(['1,5', 'x', '', '1e3', '0.1234567890123'])('rechaza el factor "%s"', (factor) => {
      expect(() => d('1').multiplicar(factor)).toThrow('El factor no es un número decimal válido');
    });
  });

  describe('porcentaje', () => {
    it('calcula el porcentaje con los decimales del catálogo', () => {
      expect(d('100').porcentaje('15').aTexto()).toBe('15.00');
      expect(d('100').porcentaje('15.0000').aTexto()).toBe('15.00');
      expect(d('1234.56').porcentaje('0.0900').aTexto()).toBe('1.11'); // 1.111104
      expect(d('0.50').porcentaje('1').aTexto()).toBe('0.01'); // 0.005 → 0.01
    });

    it('rechaza una tasa que no es decimal', () => {
      expect(() => d('1').porcentaje('15%')).toThrow(MontoInvalidoError);
    });
  });

  it('dice si es cero, positivo o negativo', () => {
    expect(Dinero.cero().esCero()).toBe(true);
    expect(d('0.01').esPositivo()).toBe(true);
    expect(d('-0.01').esNegativo()).toBe(true);
    expect(d('0').esPositivo()).toBe(false);
    expect(d('0').esNegativo()).toBe(false);
  });

  it('compara montos', () => {
    expect(d('1').compararCon(d('2'))).toBe(-1);
    expect(d('2').compararCon(d('1'))).toBe(1);
    expect(d('1').compararCon(d('1.00'))).toBe(0);
    expect(d('1').esIgualA(d('1.00'))).toBe(true);
    expect(d('2').esMayorQue(d('1'))).toBe(true);
    expect(d('1').esMenorQue(d('2'))).toBe(true);
  });

  it('se convierte desde y hacia centavos', () => {
    expect(Dinero.desdeCentavos(12345n).aTexto()).toBe('123.45');
    expect(d('-1.05').aCentavos()).toBe(-105n);
    expect(Dinero.desdeCentavos(-5n).aTexto()).toBe('-0.05');
  });

  it('en el JSON sale como texto con 2 decimales', () => {
    expect(JSON.stringify({ total: d('10.5') })).toBe('{"total":"10.50"}');
    expect(String(d('3'))).toBe('3.00');
  });
});
