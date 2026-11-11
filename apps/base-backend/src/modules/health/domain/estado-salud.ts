export type EstadoDependencia = 'ok' | 'falla';

/** Estado del servicio: disponible solo si todas sus dependencias responden. */
export interface EstadoSalud {
  disponible: boolean;
  baseDatos: EstadoDependencia;
}

export function calcularEstadoSalud(baseDatosResponde: boolean): EstadoSalud {
  return { disponible: baseDatosResponde, baseDatos: baseDatosResponde ? 'ok' : 'falla' };
}
