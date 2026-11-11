import { GeneradorContrasenaTemporalCrypto } from './generador-contrasena-temporal.crypto.js';

describe('GeneradorContrasenaTemporalCrypto', () => {
  it('12 caracteres del alfabeto legible, distintos en cada llamada', () => {
    const generador = new GeneradorContrasenaTemporalCrypto();
    const generadas = Array.from({ length: 50 }, () => generador.generar());
    for (const texto of generadas) {
      expect(texto).toHaveLength(12);
      expect(texto).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{12}$/u);
    }
    expect(new Set(generadas).size).toBe(50);
  });
});
