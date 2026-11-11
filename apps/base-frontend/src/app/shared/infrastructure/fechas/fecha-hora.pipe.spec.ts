import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FechaHoraPipe } from './fecha-hora.pipe';
import { ZONA_NEGOCIO } from './zona-negocio';

function pipe(zona?: string): FechaHoraPipe {
  TestBed.configureTestingModule({
    providers: [
      FechaHoraPipe,
      ...(zona === undefined ? [] : [{ provide: ZONA_NEGOCIO, useValue: signal(zona) }]),
    ],
  });
  return TestBed.inject(FechaHoraPipe);
}

describe('FechaHoraPipe', () => {
  it('sin la zona de la sesión, usa la de la instalación (Guayaquil)', () => {
    expect(pipe().transform('2026-11-02T15:15:00.000Z')).toBe('02/11/2026 10:15');
  });

  it('usa la zona que manda el backend', () => {
    const p = pipe('Europe/Madrid');
    expect(p.transform('2026-11-02T15:15:00.000Z')).toBe('02/11/2026 16:15');
    expect(p.transform('2026-11-02T23:30:00.000Z', 'dia')).toBe('03/11/2026');
  });

  it('sin fecha, vacío', () => {
    const p = pipe();
    expect(p.transform(null)).toBe('');
    expect(p.transform(undefined)).toBe('');
    expect(p.transform('')).toBe('');
  });
});
