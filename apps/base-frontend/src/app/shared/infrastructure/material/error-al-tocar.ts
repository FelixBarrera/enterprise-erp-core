import type { AbstractControl } from '@angular/forms';
import type { ErrorStateMatcher } from '@angular/material/core';

/**
 * Cuándo un campo se pinta con su error: si está mal **y** se tocó. Al enviar, la pantalla marca
 * todo como tocado (`markAllAsTouched()`), así que un formulario enviado vacío muestra sus errores.
 * Material, por defecto, también los muestra por haber enviado: un campo que la pantalla vació a
 * propósito (la contraseña después de un error, con `reset('')`) aparecía con «Escriba su
 * contraseña» al lado del mensaje del backend.
 */
export class ErrorAlTocar implements ErrorStateMatcher {
  isErrorState(control: AbstractControl | null): boolean {
    return control !== null && control.invalid && control.touched;
  }
}
