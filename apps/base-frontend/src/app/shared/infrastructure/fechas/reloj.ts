import { InjectionToken } from '@angular/core';

/**
 * La hora de ahora, para saber qué día es hoy en la zona del negocio (con `diaEnZona()`). Por un
 * token y no con `new Date()` suelto, para fijarla en las pruebas: `{ provide: RELOJ, useValue:
 * relojFijo('2026-11-07T10:00:00-05:00') }`.
 */
export interface Reloj {
  ahora(): Date;
}

export const RELOJ = new InjectionToken<Reloj>('RELOJ', {
  factory: () => ({ ahora: () => new Date() }),
});

/** Un reloj parado en ese instante (para las pruebas). */
export function relojFijo(iso: string): Reloj {
  const instante = new Date(iso);
  return { ahora: () => new Date(instante) };
}
