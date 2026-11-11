import {
  ALFABETO_CONTRASENA_TEMPORAL,
  armarContrasenaTemporal,
  LARGO_CONTRASENA_TEMPORAL,
} from './contrasena-temporal.js';

describe('armarContrasenaTemporal (AUTH-D13)', () => {
  it('12 caracteres del alfabeto, según el azar que recibe', () => {
    let i = 0;
    const texto = armarContrasenaTemporal((n) => i++ % n);
    expect(texto).toHaveLength(LARGO_CONTRASENA_TEMPORAL);
    expect(texto).toBe(ALFABETO_CONTRASENA_TEMPORAL.slice(0, 12));
    expect(armarContrasenaTemporal((n) => n - 1)).toBe('9'.repeat(12));
  });

  it('el alfabeto no tiene los que se confunden (0/O, 1/l/I) ni repetidos', () => {
    for (const confuso of ['0', 'O', '1', 'l', 'I']) {
      expect(ALFABETO_CONTRASENA_TEMPORAL).not.toContain(confuso);
    }
    expect(new Set(ALFABETO_CONTRASENA_TEMPORAL).size).toBe(ALFABETO_CONTRASENA_TEMPORAL.length);
    expect(ALFABETO_CONTRASENA_TEMPORAL).toHaveLength(57);
  });
});
