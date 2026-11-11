import { InjectionToken } from '@angular/core';
import type { EstadoSalud } from '../../../domain/estado-salud';

/** Pregunta al backend cómo está. Nunca lanza: si no hay respuesta, es `sin-servidor`. */
export interface VerificadorSaludPort {
  consultar(): Promise<EstadoSalud>;
}

export const VERIFICADOR_SALUD_PORT = new InjectionToken<VerificadorSaludPort>(
  'VERIFICADOR_SALUD_PORT',
);
