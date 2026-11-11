import { inject, Pipe, type PipeTransform } from '@angular/core';
import { fechaEnZona, fechaHoraEnZona, fechaHoraSegundosEnZona } from '../../domain/fechas';
import { ZONA_NEGOCIO } from './zona-negocio';

/**
 * Un instante del backend (ISO 8601) como «02/11/2026 10:15», en la zona del negocio. `null` o
 * vacío da `''`. Uso: `{{ huella.en | fechaHora }}`; solo el día: `{{ x | fechaHora: 'dia' }}`;
 * con segundos: `{{ x | fechaHora: 'segundos' }}`.
 * En la plantilla, dentro de un `<span class="numero">` (cifras del mismo ancho).
 */
@Pipe({ name: 'fechaHora' })
export class FechaHoraPipe implements PipeTransform {
  // La zona es una por instalación: no cambia mientras la pantalla está abierta.
  private readonly zona = inject(ZONA_NEGOCIO);

  transform(
    iso: string | null | undefined,
    que: 'dia' | 'dia-y-hora' | 'segundos' = 'dia-y-hora',
  ): string {
    if (iso === null || iso === undefined || iso === '') return '';
    if (que === 'dia') return fechaEnZona(iso, this.zona());
    if (que === 'segundos') return fechaHoraSegundosEnZona(iso, this.zona());
    return fechaHoraEnZona(iso, this.zona());
  }
}
