import { fuerzaContrasena, largoDeContrasenaValido } from './fuerza-contrasena';

describe('fuerzaContrasena', () => {
  it.each([
    ['', 0, 'Escriba al menos 8 caracteres'],
    ['abc', 1, 'Muy corta'],
    ['1234567', 1, 'Muy corta'],
    ['12345678', 2, 'Aceptable: más larga es más segura'],
    ['12345678901', 2, 'Aceptable: más larga es más segura'],
    ['123456789012', 3, 'Buena'],
    ['123456789012345', 3, 'Buena'],
    ['Girasol-Martes-83', 4, 'Muy buena'],
  ])('«%s» → nivel %i', (texto, nivel, mensaje) => {
    expect(fuerzaContrasena(texto)).toEqual({ nivel, texto: mensaje });
  });
});

describe('largoDeContrasenaValido', () => {
  it('de 8 a 128 caracteres', () => {
    expect(largoDeContrasenaValido('1234567')).toBe(false);
    expect(largoDeContrasenaValido('12345678')).toBe(true);
    expect(largoDeContrasenaValido('x'.repeat(128))).toBe(true);
    expect(largoDeContrasenaValido('x'.repeat(129))).toBe(false);
  });
});
