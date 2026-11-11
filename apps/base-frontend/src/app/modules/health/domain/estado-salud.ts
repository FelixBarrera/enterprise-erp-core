/**
 * Cómo está el servicio, visto desde la aplicación web:
 * - `en-marcha`: la API y la base de datos responden.
 * - `sin-base-datos`: la API responde, pero la base de datos no.
 * - `sin-servidor`: la API no responde (apagada o sin red).
 */
export type EstadoSalud = 'en-marcha' | 'sin-base-datos' | 'sin-servidor';

export interface ResumenSalud {
  estado: EstadoSalud;
  disponible: boolean;
  mensaje: string;
}

const MENSAJES: Record<EstadoSalud, string> = {
  'en-marcha': 'El sistema está en marcha.',
  'sin-base-datos': 'El servidor responde, pero la base de datos no está disponible.',
  'sin-servidor': 'No hay conexión con el servidor.',
};

export function resumirSalud(estado: EstadoSalud): ResumenSalud {
  return { estado, disponible: estado === 'en-marcha', mensaje: MENSAJES[estado] };
}
