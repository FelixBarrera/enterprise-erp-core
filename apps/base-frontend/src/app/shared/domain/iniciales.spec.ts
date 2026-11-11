import { iniciales } from './iniciales';

describe('iniciales', () => {
  it.each([
    ['Ana Pérez', 'AP'],
    ['Ana María Pérez Salas', 'AS'],
    ['Comercial Ejemplo', 'CE'],
    ['ana', 'A'],
    ['  ñandú   órdenes ', 'ÑÓ'],
    ['(Grupo) Uno', 'GU'],
    ['Fondo 2026', 'F2'],
  ])('«%s» → %s', (nombre, esperado) => {
    expect(iniciales(nombre)).toBe(esperado);
  });

  it.each(['', '   ', '— —'])('sin letras («%s») → ?', (nombre) => {
    expect(iniciales(nombre)).toBe('?');
  });
});
