import { TestBed } from '@angular/core/testing';
import { RELOJ, relojFijo } from './reloj';

describe('RELOJ', () => {
  it('por defecto, la hora de ahora', () => {
    const antes = Date.now();
    const ahora = TestBed.inject(RELOJ).ahora().getTime();
    expect(ahora).toBeGreaterThanOrEqual(antes);
    expect(ahora).toBeLessThanOrEqual(Date.now());
  });

  it('relojFijo: siempre el mismo instante', () => {
    const reloj = relojFijo('2026-11-07T10:00:00-05:00');
    expect(reloj.ahora().toISOString()).toBe('2026-11-07T15:00:00.000Z');
    expect(reloj.ahora()).not.toBe(reloj.ahora());
  });
});
