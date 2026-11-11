import { InjectionToken } from '@angular/core';

export interface CerrarSesionPort {
  /** Si el backend no responde, lanza y la sesión se mantiene. */
  execute(): Promise<void>;
}

export const CERRAR_SESION_PORT = new InjectionToken<CerrarSesionPort>('CERRAR_SESION_PORT');
