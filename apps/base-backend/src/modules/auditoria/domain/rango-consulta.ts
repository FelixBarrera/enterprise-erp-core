import { FechaFiscal } from '../../../shared/domain/value-objects/fecha-fiscal.vo.js';
import { RangoFechasInvalidoError } from './errors/auditoria.errors.js';

/** Días que puede abarcar una búsqueda en la bitácora, contando los dos extremos (AUD-D8). */
export const RANGO_MAXIMO_DIAS = 92;

export const MENSAJE_RANGO_LARGO = `El rango no puede pasar de ${RANGO_MAXIMO_DIAS} días`;
export const MENSAJE_RANGO_INVERTIDO = 'La fecha desde no puede ser mayor que la fecha hasta';
export const MENSAJE_FECHAS_OBLIGATORIAS =
  'Las fechas desde y hasta son obligatorias, salvo en la historia de un registro';

/** Los instantes que abarca la búsqueda: `>= desde` y `< hastaAntesDe`. */
export interface RangoInstantes {
  readonly desde: Date;
  readonly hastaAntesDe: Date;
}

/** La historia de un registro: cada extremo es opcional (sin él, sin tope de ese lado). */
export type RangoAbierto = Partial<RangoInstantes>;

/**
 * De `desde` a `hasta` (días del negocio, los dos incluidos) a instantes: desde las 00:00 de
 * `desde` hasta antes de las 00:00 del día siguiente a `hasta`, en la zona del negocio.
 * Lanza `RangoFechasInvalidoError` si está al revés o pasa de 92 días.
 */
export function rangoDeConsulta(desde: FechaFiscal, hasta: FechaFiscal): RangoInstantes {
  if (desde.esPosteriorA(hasta)) {
    throw new RangoFechasInvalidoError(MENSAJE_RANGO_INVERTIDO);
  }
  if (desde.sumarDias(RANGO_MAXIMO_DIAS - 1).esAnteriorA(hasta)) {
    throw new RangoFechasInvalidoError(MENSAJE_RANGO_LARGO);
  }
  return { desde: desde.inicioDelDia(), hastaAntesDe: hasta.sumarDias(1).inicioDelDia() };
}

/**
 * La historia de un solo registro (6.12c0b, decisión del usuario): `desde` y `hasta` son
 * opcionales y no hay tope de días, porque la búsqueda va por el índice del registro y no recorre
 * la bitácora. Con los dos, lanza `RangoFechasInvalidoError` si están al revés.
 */
export function rangoDeHistoria(desde?: FechaFiscal, hasta?: FechaFiscal): RangoAbierto {
  if (desde !== undefined && hasta !== undefined && desde.esPosteriorA(hasta)) {
    throw new RangoFechasInvalidoError(MENSAJE_RANGO_INVERTIDO);
  }
  return {
    desde: desde?.inicioDelDia(),
    hastaAntesDe: hasta?.sumarDias(1).inicioDelDia(),
  };
}
