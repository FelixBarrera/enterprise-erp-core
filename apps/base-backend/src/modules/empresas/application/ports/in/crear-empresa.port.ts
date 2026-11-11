import type { Actor } from '../../../../../shared/application/actor.js';
import type { EmpresaConsultada } from './consultar-empresas.port.js';

export const CREAR_EMPRESA_PORT = Symbol('CREAR_EMPRESA_PORT');

export interface CrearEmpresaComando {
  readonly nombre: string;
}

/**
 * Crea una empresa y registra `empresas.empresa.crear`. Solo la usan los comandos del servidor
 * (EMP-D2: nunca una pantalla). El comando de `auth` la llama dentro de su propia transacción,
 * junto con el rol Administrador y su usuario (EMP-D3): esta se une a la de afuera.
 */
export interface CrearEmpresaPort {
  crear(comando: CrearEmpresaComando, actor: Actor): Promise<EmpresaConsultada>;
}
