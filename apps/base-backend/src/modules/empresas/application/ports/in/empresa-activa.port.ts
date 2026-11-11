import type { Actor } from '../../../../../shared/application/actor.js';
import type { EmpresaConsultada } from './consultar-empresas.port.js';

export const EMPRESA_ACTIVA_PORT = Symbol('EMPRESA_ACTIVA_PORT');

/** Lo que se cambia; un campo que no viene queda igual. */
export interface EditarEmpresaComando {
  readonly nombre?: string;
}

/**
 * La empresa activa de quien opera (la de su sesión): `GET` y `PATCH /empresa`. Nunca otra:
 * no se recibe un id.
 */
export interface EmpresaActivaPort {
  /** Sus datos. `EmpresaNoEncontradaError` si no hay empresa activa o ya no está activa. */
  ver(actor: Actor): Promise<EmpresaConsultada>;
  /**
   * Cambia sus datos y registra `empresas.empresa.editar` con lo que cambió. Si nada cambia, no
   * escribe ni registra.
   */
  editar(comando: EditarEmpresaComando, actor: Actor): Promise<EmpresaConsultada>;
}
