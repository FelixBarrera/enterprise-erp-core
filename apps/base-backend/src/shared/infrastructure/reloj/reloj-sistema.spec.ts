import { RelojSistema } from './reloj-sistema.js';

describe('RelojSistema', () => {
  it('da la hora actual del servidor', () => {
    const antes = Date.now();
    const ahora = new RelojSistema().ahora().getTime();
    expect(ahora).toBeGreaterThanOrEqual(antes);
    expect(ahora).toBeLessThanOrEqual(Date.now());
  });
});
