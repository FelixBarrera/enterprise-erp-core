import { actorDelSistema, type Actor } from '../../../../../../shared/application/actor.js';
import { DomainError } from '../../../../../../shared/domain/errors/domain-error.js';
import { EntradaCanceladaError, type Terminal } from './terminal.js';

/** Lo que devuelve un comando al sistema operativo. */
export const SALIDA_OK = 0;
export const SALIDA_ERROR = 1;
/** Como cualquier programa cortado con Ctrl+C. */
export const SALIDA_CANCELADO = 130;

/** Veces que se repite una pregunta mal contestada antes de rendirse. */
export const INTENTOS_POR_PREGUNTA = 3;

/** Un comando `admin:*`: corre y dice cómo terminó. */
export interface ComandoAdmin {
  ejecutar(): Promise<number>;
}

/** El actor de un comando: el sistema, con el nombre del comando (así queda en la bitácora). */
export function actorDelComando(nombre: string): Actor {
  return actorDelSistema({ nombreUsuario: nombre });
}

/**
 * Corre el cuerpo de un comando: un error del negocio o una cancelación se muestran en
 * español y terminan el comando sin cambios; cualquier otro error sigue (es un fallo real).
 */
export async function correr(terminal: Terminal, cuerpo: () => Promise<number>): Promise<number> {
  try {
    return await cuerpo();
  } catch (error) {
    if (error instanceof EntradaCanceladaError) {
      terminal.escribir('');
      terminal.escribir(error.message);
      return SALIDA_CANCELADO;
    }
    if (error instanceof DomainError) {
      terminal.escribir(`No se pudo: ${error.message}. No se guardó ningún cambio.`);
      return SALIDA_ERROR;
    }
    throw error;
  }
}

/** Lo que dice `revisar` de una respuesta: el valor que sirve, o por qué no sirve. */
export type Revision<T> = { readonly valor: T } | { readonly motivo: string };

export const valido = <T>(valor: T): Revision<T> => ({ valor });
export const rechazo = (motivo: string): Revision<never> => ({ motivo });

/**
 * Pregunta hasta que `revisar` acepta la respuesta o se acaban los intentos (entonces `null`).
 * El motivo de cada rechazo se muestra antes de preguntar otra vez.
 */
export async function preguntarHasta<T>(
  terminal: Terminal,
  preguntar: () => Promise<string>,
  revisar: (respuesta: string) => Promise<Revision<T>> | Revision<T>,
): Promise<{ readonly valor: T } | null> {
  for (let intento = 1; intento <= INTENTOS_POR_PREGUNTA; intento++) {
    const revision = await revisar(await preguntar());
    if ('valor' in revision) {
      return revision;
    }
    terminal.escribir(`  ${revision.motivo}`);
  }
  terminal.escribir('Demasiados intentos: no se hizo ningún cambio.');
  return null;
}

/** Texto no vacío (recortado). */
export const obligatorio = (respuesta: string): Revision<string> =>
  respuesta.trim() === '' ? rechazo('Es obligatorio.') : valido(respuesta.trim());

/** "s", "si" o "sí", sin importar mayúsculas. */
export function esSi(respuesta: string): boolean {
  return ['s', 'si', 'sí'].includes(respuesta.trim().toLowerCase());
}
