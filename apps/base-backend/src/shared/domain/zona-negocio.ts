import { FechaInvalidaError, ZonaHorariaInvalidaError } from './errors/valores.errors.js';

/**
 * La zona del negocio (regla 11): la hora y "qué día es" salen SIEMPRE de esta zona, esté donde
 * esté el servidor. Nada en el backend debe depender de la zona del proceso (`TZ`) ni de la del
 * navegador.
 *
 * Es una por instalación (EMP-D7): la elige `ZONA_NEGOCIO` del `.env` y la fija la
 * infraestructura UNA vez al arrancar (`ZonaNegocioModule`). El dominio no lee el `.env`.
 * Se elige al instalar y no se cambia con datos guardados: las fechas ya calculadas no se
 * recalculan.
 */
export const ZONA_NEGOCIO_POR_DEFECTO = 'America/Guayaquil';

/** Fecha y hora de un instante tal como se ven en la zona del negocio (mes de 1 a 12, hora de 0 a 23). */
export interface PartesFechaHora {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

// Intl ya viene con Node (no es una librería): calcula la hora de una zona sin mirar la del proceso.
function crearFormato(zona: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

let zonaActual = ZONA_NEGOCIO_POR_DEFECTO;
let formatoZonaNegocio = crearFormato(zonaActual);

/**
 * `true` si es el nombre exacto de una zona (`America/Guayaquil`, `Europe/Madrid`, `UTC`).
 * Se rechazan los desfases sueltos (`-05:00`) y las abreviaturas (`EST`): no siguen los
 * cambios de horario de verano y no dicen de qué lugar es la hora.
 */
export function esZonaHorariaValida(zona: string): boolean {
  return zona === 'UTC' || Intl.supportedValuesOf('timeZone').includes(zona);
}

/** La zona del negocio en uso (por ejemplo, para mandársela al frontend). */
export function zonaNegocio(): string {
  return zonaActual;
}

/** Solo la infraestructura, al arrancar (y las pruebas). */
export function fijarZonaNegocio(zona: string): void {
  if (!esZonaHorariaValida(zona)) {
    throw new ZonaHorariaInvalidaError();
  }
  zonaActual = zona;
  formatoZonaNegocio = crearFormato(zona);
}

/** Descompone un instante en la fecha y la hora de la zona del negocio. */
export function partesEnZonaNegocio(instante: Date): PartesFechaHora {
  if (Number.isNaN(instante.getTime())) {
    throw new FechaInvalidaError();
  }
  const partes = new Map(
    formatoZonaNegocio.formatToParts(instante).map((parte) => [parte.type, Number(parte.value)]),
  );
  const leer = (tipo: Intl.DateTimeFormatPartTypes): number => partes.get(tipo) ?? 0;
  return {
    anio: leer('year'),
    mes: leer('month'),
    dia: leer('day'),
    hora: leer('hour'),
    minuto: leer('minute'),
    segundo: leer('second'),
  };
}
