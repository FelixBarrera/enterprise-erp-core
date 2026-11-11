import type { Actor } from '../../../../../shared/application/actor.js';
import type { EmpresaConsultada } from './consultar-empresas.port.js';

export const RENOMBRAR_EMPRESA_PORT = Symbol('RENOMBRAR_EMPRESA_PORT');

export interface ResultadoRenombrarEmpresa {
  readonly empresa: EmpresaConsultada;
  /** `false` si ya tenía ese nombre: no cambió nada ni se registró evento (OPS-03). */
  readonly cambio: boolean;
}

/**
 * Cambia el nombre de cualquier empresa activa, por su id, y registra `empresas.empresa.editar`
 * en ella. Solo por comando (`admin:renombrar-empresa`, 6.15a): por la API, solo la empresa
 * activa de la sesión (`EMPRESA_ACTIVA_PORT`).
 */
export interface RenombrarEmpresaPort {
  renombrar(id: string, nombre: string, actor: Actor): Promise<ResultadoRenombrarEmpresa>;
}
