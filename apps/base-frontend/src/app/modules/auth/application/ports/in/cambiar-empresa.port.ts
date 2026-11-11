import { InjectionToken } from '@angular/core';
import type { Sesion } from '../../../domain/sesion';

export interface CambiarEmpresaPort {
  /**
   * Pasa la sesión a otra de sus empresas (AUTH-D5) y borra lo guardado de la anterior. Devuelve
   * la sesión ya con la empresa nueva (sus permisos son los de esa empresa). Lanza el `ErrorHttp`
   * del backend (sin acceso a esa empresa, sin conexión): ya avisado por el aviso global.
   */
  execute(empresaId: string): Promise<Sesion>;
}

export const CAMBIAR_EMPRESA_PORT = new InjectionToken<CambiarEmpresaPort>('CAMBIAR_EMPRESA_PORT');
