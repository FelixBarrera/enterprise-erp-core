import type { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Obligatorio: vacío o solo espacios es un error `{ obligatorio: true }` (docs/arquitectura-frontend.md,
 * sección 3). Solo revisa: no cambia lo escrito (el backend normaliza).
 */
export function obligatorio(control: AbstractControl<unknown>): ValidationErrors | null {
  const valor = control.value;
  if (valor === null || valor === undefined) return { obligatorio: true };
  if (typeof valor === 'string' && valor.trim() === '') return { obligatorio: true };
  return null;
}
