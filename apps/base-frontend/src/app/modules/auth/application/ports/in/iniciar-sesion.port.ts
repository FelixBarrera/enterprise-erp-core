import { InjectionToken } from '@angular/core';
import type { Credenciales, ResultadoIngreso } from '../../../domain/sesion';

export interface IniciarSesionPort {
  /** Lanza el `ErrorHttp` del backend: credenciales inválidas, sin empresa, demasiados intentos. */
  execute(credenciales: Credenciales): Promise<ResultadoIngreso>;
}

export const INICIAR_SESION_PORT = new InjectionToken<IniciarSesionPort>('INICIAR_SESION_PORT');
