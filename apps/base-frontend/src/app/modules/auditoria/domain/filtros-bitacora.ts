import { diaATexto, sumarDias } from '../../../shared/domain/fechas';
import type { RegistroBitacora } from './registro';

/** La bitácora abre con los últimos 7 días: hoy (en la zona del negocio) y 6 días atrás. */
export const DIAS_POR_DEFECTO = 7;

/** El tope de una búsqueda (AUD-D8). Lo revisa el backend; la pantalla solo lo dice. */
export const RANGO_MAXIMO_DIAS = 92;

/**
 * Los filtros de la bitácora. Las fechas, días del negocio `aaaa-mm-dd`, los dos incluidos; en la
 * historia de un registro pueden ir vacías (`''`: sin límite, 6.12c0b).
 */
export interface FiltrosBitacora {
  readonly desde: string;
  readonly hasta: string;
  /** El id de quien lo hizo; `''`, todos. */
  readonly usuario: string;
  /** Una acción (`auth.usuario.crear`) o un grupo (`auth.usuario`); `''`, todo. */
  readonly accion: string;
  /** Solo la historia de este registro (no es un filtro: no se limpia); `null`, toda la empresa. */
  readonly registro: RegistroBitacora | null;
}

/**
 * Sin filtros: los últimos 7 días hasta `hoy` (`aaaa-mm-dd` en la zona del negocio). En la
 * historia de un registro, sin fechas: toda su historia.
 */
export function filtrosBitacoraIniciales(
  hoy: string,
  registro: RegistroBitacora | null = null,
): FiltrosBitacora {
  if (registro !== null) return { desde: '', hasta: '', usuario: '', accion: '', registro };
  return {
    desde: sumarDias(hoy, -(DIAS_POR_DEFECTO - 1)),
    hasta: hoy,
    usuario: '',
    accion: '',
    registro: null,
  };
}

/**
 * «01/11 – 07/11/2026» (el año una vez si es el mismo), para el celular. Con una fecha vacía (la
 * historia de un registro): «Desde 01/11/2026», «Hasta 07/11/2026» o «Todas las fechas».
 */
export function textoRango(desde: string, hasta: string): string {
  if (desde === '' && hasta === '') return 'Todas las fechas';
  if (hasta === '') return `Desde ${diaATexto(desde)}`;
  if (desde === '') return `Hasta ${diaATexto(hasta)}`;
  const inicio = diaATexto(desde);
  const fin = diaATexto(hasta);
  if (desde === hasta) return fin;
  return desde.slice(0, 4) === hasta.slice(0, 4)
    ? `${inicio.slice(0, 5)} – ${fin}`
    : `${inicio} – ${fin}`;
}
