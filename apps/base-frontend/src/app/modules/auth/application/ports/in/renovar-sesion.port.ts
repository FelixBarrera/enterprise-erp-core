import { InjectionToken } from '@angular/core';
import type { SesionAbierta } from '../../../domain/sesion';

export interface RenovarSesionPort {
  /** Token nuevo y la sesión al día (permisos incluidos). `null` si la sesión terminó. */
  execute(): Promise<SesionAbierta | null>;
}

export const RENOVAR_SESION_PORT = new InjectionToken<RenovarSesionPort>('RENOVAR_SESION_PORT');
