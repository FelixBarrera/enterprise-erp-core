import type { EstadoSalud } from '../../../domain/estado-salud.js';

export const CONSULTAR_SALUD_PORT = Symbol('CONSULTAR_SALUD_PORT');

export interface ConsultarSaludPort {
  execute(): Promise<EstadoSalud>;
}
