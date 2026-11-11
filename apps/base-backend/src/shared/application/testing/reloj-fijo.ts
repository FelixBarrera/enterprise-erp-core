import type { RelojPort } from '../ports/reloj.port.js';

/**
 * Reloj para pruebas: siempre da la hora que se le fija.
 * - Unitarios: `new RelojFijo('2026-07-15T11:00:00-05:00')` por el constructor del caso de uso.
 * - e2e: `crearApp({ sobrescribir: (b) => b.overrideProvider(RELOJ_PORT).useValue(reloj) })`.
 * Escribir la hora con su zona (`-05:00` = Guayaquil) para que la prueba se lea sola.
 */
export class RelojFijo implements RelojPort {
  private instante: Date;

  constructor(instante: string | Date) {
    this.instante = RelojFijo.leer(instante);
  }

  ahora(): Date {
    // Una copia: si alguien la modifica, el reloj no cambia.
    return new Date(this.instante.getTime());
  }

  /** Cambia la hora fijada. */
  fijar(instante: string | Date): void {
    this.instante = RelojFijo.leer(instante);
  }

  /** Adelanta el reloj (para probar vencimientos: sesiones, plazos). */
  avanzarMinutos(minutos: number): void {
    this.instante = new Date(this.instante.getTime() + minutos * 60_000);
  }

  private static leer(instante: string | Date): Date {
    const fecha = new Date(instante);
    if (Number.isNaN(fecha.getTime())) {
      throw new Error(`RelojFijo: la hora "${String(instante)}" no es válida`);
    }
    return fecha;
  }
}
