import type { Actor } from '../../../../../shared/application/actor.js';
import type { EmpresaConsultada } from './consultar-empresas.port.js';

export const DESACTIVAR_EMPRESA_PORT = Symbol('DESACTIVAR_EMPRESA_PORT');

export interface ResultadoDesactivarEmpresa {
  readonly empresa: EmpresaConsultada;
  /** `true` si ya estaba desactivada: no cambió nada ni se registró evento (OPS-03). */
  readonly yaEstabaDesactivada: boolean;
}

/**
 * Desactiva una empresa (EMP-D9) y registra `empresas.empresa.desactivar`. Solo por comando.
 * Cerrar las sesiones abiertas en ella le toca a `auth`, en la misma transacción.
 */
export interface DesactivarEmpresaPort {
  desactivar(id: string, actor: Actor): Promise<ResultadoDesactivarEmpresa>;
}
