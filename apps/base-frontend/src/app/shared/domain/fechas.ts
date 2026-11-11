/**
 * La zona de la instalación si todavía no llegó la de la sesión (la misma que usa el backend por
 * defecto, `ZONA_NEGOCIO`). Las pantallas siempre tienen sesión: es solo un respaldo.
 */
export const ZONA_NEGOCIO_POR_DEFECTO = 'America/Guayaquil';

const formatos = new Map<string, Intl.DateTimeFormat>();

function formato(zona: string): Intl.DateTimeFormat {
  let existente = formatos.get(zona);
  if (existente === undefined) {
    existente = new Intl.DateTimeFormat('es-EC', {
      timeZone: zona,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatos.set(zona, existente);
  }
  return existente;
}

function partes(instante: Date, zona: string): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const parte of formato(zona).formatToParts(instante)) resultado[parte.type] = parte.value;
  return resultado;
}

function aInstante(iso: string): Date | null {
  const instante = new Date(iso);
  return Number.isNaN(instante.getTime()) ? null : instante;
}

/**
 * «02/11/2026 10:15» en la zona del negocio (regla 11: nunca la del navegador). Un texto que no es
 * una fecha da `''`.
 */
export function fechaHoraEnZona(iso: string, zona: string): string {
  const instante = aInstante(iso);
  if (instante === null) return '';
  const p = partes(instante, zona);
  return `${p['day']}/${p['month']}/${p['year']} ${p['hour']}:${p['minute']}`;
}

/** «02/11/2026 10:15:42» en la zona del negocio (el detalle de la bitácora). Sin fecha, `''`. */
export function fechaHoraSegundosEnZona(iso: string, zona: string): string {
  const instante = aInstante(iso);
  if (instante === null) return '';
  const p = partes(instante, zona);
  return `${p['day']}/${p['month']}/${p['year']} ${p['hour']}:${p['minute']}:${p['second']}`;
}

/** «02/11/2026» en la zona del negocio. Un texto que no es una fecha da `''`. */
export function fechaEnZona(iso: string, zona: string): string {
  const instante = aInstante(iso);
  if (instante === null) return '';
  const p = partes(instante, zona);
  return `${p['day']}/${p['month']}/${p['year']}`;
}

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MS_POR_DIA = 86_400_000;

/**
 * El día de un instante en la zona del negocio, como `aaaa-mm-dd` (el formato de los filtros de
 * fecha del backend y de `<input type="date">`). Para «hoy»: `diaEnZona(reloj.ahora(), zona)`.
 */
export function diaEnZona(instante: Date, zona: string): string {
  const p = partes(instante, zona);
  return `${p['year']}-${p['month']}-${p['day']}`;
}

/** `true` si es un día real escrito `aaaa-mm-dd` (`2026-02-30` no lo es). */
export function esDia(texto: string): boolean {
  const m = DIA.exec(texto);
  if (m === null) return false;
  const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return fecha.toISOString().slice(0, 10) === texto;
}

/** Otro día, `n` días después (o antes, con `n` negativo). El día tiene que ser válido (`esDia`). */
export function sumarDias(dia: string, n: number): string {
  const [anio, mes, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, d) + n * MS_POR_DIA).toISOString().slice(0, 10);
}

/** «07/11/2026» de un día `aaaa-mm-dd` (sin zona: ya es un día del negocio). */
export function diaATexto(dia: string): string {
  const [anio, mes, d] = dia.split('-');
  return `${d}/${mes}/${anio}`;
}

/** El lugar de una zona, para decirlo en pantalla: `America/Guayaquil` → «Guayaquil». */
export function lugarDeZona(zona: string): string {
  return (zona.split('/').at(-1) ?? zona).replaceAll('_', ' ');
}
