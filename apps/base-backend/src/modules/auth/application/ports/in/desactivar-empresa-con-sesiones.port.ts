import type { Actor } from '../../../../../shared/application/actor.js';
import type { ResultadoDesactivarEmpresa } from '../../../../empresas/application/ports/in/desactivar-empresa.port.js';

export const DESACTIVAR_EMPRESA_CON_SESIONES_PORT = Symbol('DESACTIVAR_EMPRESA_CON_SESIONES_PORT');

export interface ResultadoDesactivarEmpresaConSesiones extends ResultadoDesactivarEmpresa {
  /** Cuántas sesiones abiertas en ella se cerraron (`EMPRESA_DESACTIVADA`). */
  readonly sesionesCerradas: number;
}

/**
 * Lo que usa `admin:desactivar-empresa`: desactiva la empresa (`DESACTIVAR_EMPRESA_PORT`) y
 * cierra sus sesiones abiertas, **en la misma transacción**. Se puede correr dos veces: si ya
 * estaba desactivada, igual cierra lo que haya quedado abierto.
 */
export interface DesactivarEmpresaConSesionesPort {
  desactivar(id: string, actor: Actor): Promise<ResultadoDesactivarEmpresaConSesiones>;
}
