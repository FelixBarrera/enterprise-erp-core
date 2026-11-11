import type { ArgumentMetadata } from '@nestjs/common';
import { CaracterNuloPipe } from './caracter-nulo.pipe.js';

const pipe = new CaracterNuloPipe();
const cuerpo: ArgumentMetadata = { type: 'body' };

describe('CaracterNuloPipe', () => {
  it('deja pasar valores sin carácter nulo, sin cambiarlos', () => {
    const valor = {
      nombre: 'Uno',
      lista: ['a', { b: 'c' }],
      numero: 1,
      nada: null,
    };
    expect(pipe.transform(valor, cuerpo)).toBe(valor);
  });

  it('rechaza un texto con \\0 y dice el campo', () => {
    expect(() => pipe.transform({ nombre: 'a\0b' }, cuerpo)).toThrow(
      'El campo nombre tiene un carácter no permitido',
    );
  });

  it('busca en objetos y listas anidados', () => {
    expect(() => pipe.transform({ lista: ['ok', { texto: '\0' }] }, cuerpo)).toThrow(
      'El campo lista[1].texto tiene un carácter no permitido',
    );
  });

  it('también revisa las claves', () => {
    expect(() => pipe.transform({ 'cla\0ve': 1 }, cuerpo)).toThrow(
      'tiene un carácter no permitido',
    );
  });

  it('usa el nombre del parámetro cuando es un valor suelto', () => {
    expect(() => pipe.transform('x\0', { type: 'param', data: 'id' })).toThrow(
      'El campo id tiene un carácter no permitido',
    );
    expect(() => pipe.transform('x\0', { type: 'query' })).toThrow(
      'Un campo tiene un carácter no permitido',
    );
  });

  it('no revisa los decoradores propios (type custom)', () => {
    expect(pipe.transform('x\0', { type: 'custom' })).toBe('x\0');
  });
});
