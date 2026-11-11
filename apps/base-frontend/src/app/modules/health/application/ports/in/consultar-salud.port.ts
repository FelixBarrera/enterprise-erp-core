import { InjectionToken } from '@angular/core';
import type { ResumenSalud } from '../../../domain/estado-salud';

export interface ConsultarSaludPort {
  execute(): Promise<ResumenSalud>;
}

export const CONSULTAR_SALUD_PORT = new InjectionToken<ConsultarSaludPort>('CONSULTAR_SALUD_PORT');
