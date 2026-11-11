import type { Actor } from '../../../../../shared/application/actor.js';
import type { SesionVista } from './consultar-sesion.port.js';

export const CAMBIAR_EMPRESA_PORT = Symbol('CAMBIAR_EMPRESA_PORT');

export interface CambiarEmpresaComando {
  /** La sesión de la petición (ya revisada por el guard). */
  readonly sesionId: string;
  readonly usuarioId: string;
  /** La empresa a la que quiere pasar. */
  readonly empresaId: string;
}

/**
 * `POST /auth/empresa` (sección 5 del diseño): con un rol activo en la empresa pedida y la
 * empresa activa, la sesión pasa a esa empresa, queda como la última usada y se registra
 * `auth.sesion.cambiar_empresa` (en la empresa nueva). Responde la sesión ya con la empresa
 * nueva. Si no tiene acceso: `SinAccesoEmpresaError` (403).
 */
export interface CambiarEmpresaPort {
  execute(comando: CambiarEmpresaComando, actor: Actor): Promise<SesionVista>;
}
