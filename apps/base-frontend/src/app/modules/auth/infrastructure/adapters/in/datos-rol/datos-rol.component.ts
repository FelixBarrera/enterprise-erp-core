import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { obligatorio } from '../../../../../../shared/infrastructure/formularios/validadores';
import { LARGO_MAXIMO_DESCRIPCION_ROL, LARGO_MAXIMO_NOMBRE_ROL } from '../../../../domain/rol';

export type FormularioRol = FormGroup<{
  nombre: FormControl<string>;
  descripcion: FormControl<string>;
}>;

/** El formulario de «Datos del rol», con los mismos topes que el backend. */
export function crearFormularioRol(): FormularioRol {
  return new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [obligatorio, Validators.maxLength(LARGO_MAXIMO_NOMBRE_ROL)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LARGO_MAXIMO_DESCRIPCION_ROL)],
    }),
  });
}

/**
 * Los campos nombre y descripción de un rol, en la ficha y en el alta (el mismo molde). La tarjeta
 * y su título los pone la pantalla.
 */
@Component({
  selector: 'app-datos-rol',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="campo">
      <label class="etiqueta" for="rol-nombre">Nombre</label>
      <mat-form-field subscriptSizing="dynamic">
        <input
          #campoNombre
          matInput
          id="rol-nombre"
          [formControl]="formulario().controls.nombre"
          autocomplete="sin-autollenado"
        />
        @if (formulario().controls.nombre.hasError('obligatorio')) {
          <mat-error>Escriba el nombre del rol</mat-error>
        } @else if (formulario().controls.nombre.hasError('maxlength')) {
          <mat-error>Puede tener hasta {{ largoNombre }} caracteres</mat-error>
        }
      </mat-form-field>
    </div>
    <div class="campo">
      <label class="etiqueta" for="rol-descripcion">
        Descripción <span class="opcional">(opcional)</span>
      </label>
      <mat-form-field subscriptSizing="dynamic">
        <textarea
          #campoDescripcion
          matInput
          id="rol-descripcion"
          [formControl]="formulario().controls.descripcion"
          rows="3"
          placeholder="Para qué sirve este rol"
          autocomplete="sin-autollenado"
        ></textarea>
        @if (formulario().controls.descripcion.hasError('maxlength')) {
          <mat-error>Puede tener hasta {{ largoDescripcion }} caracteres</mat-error>
        }
      </mat-form-field>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .campo {
      margin-bottom: 14px;

      &:last-child {
        margin-bottom: 0;
      }

      mat-form-field {
        width: 100%;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatosRolComponent {
  readonly formulario = input.required<FormularioRol>();

  protected readonly largoNombre = LARGO_MAXIMO_NOMBRE_ROL;
  protected readonly largoDescripcion = LARGO_MAXIMO_DESCRIPCION_ROL;

  private readonly campoNombre = viewChild.required<ElementRef<HTMLInputElement>>('campoNombre');
  private readonly campoDescripcion =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('campoDescripcion');

  /** Al enviar con errores: el foco en el primero. */
  enfocarPrimerError(): void {
    const campo = this.formulario().controls.nombre.invalid
      ? this.campoNombre()
      : this.campoDescripcion();
    campo.nativeElement.focus();
  }
}
