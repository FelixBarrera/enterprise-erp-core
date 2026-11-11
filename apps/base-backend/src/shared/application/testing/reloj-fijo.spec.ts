import { RelojFijo } from './reloj-fijo.js';

describe('RelojFijo', () => {
  it('da siempre la hora fijada', () => {
    const reloj = new RelojFijo('2026-07-15T11:00:00-05:00');
    expect(reloj.ahora().toISOString()).toBe('2026-07-15T16:00:00.000Z');
    expect(reloj.ahora().toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });

  it('entrega una copia: modificarla no cambia el reloj', () => {
    const reloj = new RelojFijo(new Date('2026-07-15T16:00:00Z'));
    reloj.ahora().setFullYear(2000);
    expect(reloj.ahora().toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });

  it('se puede fijar otra hora y adelantar', () => {
    const reloj = new RelojFijo('2026-07-15T16:00:00Z');
    reloj.avanzarMinutos(90);
    expect(reloj.ahora().toISOString()).toBe('2026-07-15T17:30:00.000Z');
    reloj.fijar('2026-12-31T23:59:59Z');
    expect(reloj.ahora().toISOString()).toBe('2026-12-31T23:59:59.000Z');
  });

  it('rechaza una hora inválida', () => {
    expect(() => new RelojFijo('mañana')).toThrow('RelojFijo: la hora "mañana" no es válida');
  });
});
