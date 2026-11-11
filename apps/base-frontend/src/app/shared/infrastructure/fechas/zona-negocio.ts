import { InjectionToken, type Signal, signal } from '@angular/core';
import { ZONA_NEGOCIO_POR_DEFECTO } from '../../domain/fechas';

/**
 * La zona horaria del negocio (regla 11), la que manda el backend con la sesión. Las fechas de las
 * pantallas se muestran en ella, nunca en la del navegador. La entrega el módulo `auth` desde
 * `app.config.ts` (shared/ no conoce los módulos); sin él (pruebas), la de la instalación por
 * defecto.
 */
export const ZONA_NEGOCIO = new InjectionToken<Signal<string>>('ZONA_NEGOCIO', {
  factory: () => signal(ZONA_NEGOCIO_POR_DEFECTO).asReadonly(),
});
