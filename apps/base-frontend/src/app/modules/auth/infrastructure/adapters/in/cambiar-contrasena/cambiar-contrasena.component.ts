import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { obligatorio } from '../../../../../../shared/infrastructure/formularios/validadores';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import { MarcaComponent } from '../../../../../../shared/infrastructure/layout/marca/marca.component';
import { destinoTrasIngreso } from '../../../../domain/destino-tras-ingreso';
import { fuerzaContrasena, largoDeContrasenaValido } from '../../../../domain/fuerza-contrasena';
import { SesionFacade } from '../../../presentation/facades/sesion.facade';

const MENSAJE_INESPERADO = 'No se pudo cambiar la contraseña. Intente de nuevo.';

/** Datos de la ruta: con la contraseña temporal, la pantalla va fuera del layout. */
export interface DatosRutaCambiarContrasena {
  readonly temporal: boolean;
}

/** La contraseña nueva, con el largo que acepta el backend (vacía la marca `obligatorio`). */
function largoContrasena(control: AbstractControl<string>): ValidationErrors | null {
  const valor = control.value;
  return valor.length === 0 || largoDeContrasenaValido(valor) ? null : { largo: true };
}

/** «Repita la contraseña nueva»: igual a la nueva. */
function igualALaNueva(control: AbstractControl<string>): ValidationErrors | null {
  const nueva = control.parent?.get('nueva')?.value as string | undefined;
  return control.value.length === 0 || control.value === nueva ? null : { noCoincide: true };
}

/**
 * Cambiar la contraseña (AUTH-D14), con el mismo formulario en sus dos usos:
 * - **temporal** (`/contrasena-temporal`): fuera del layout, sin menú, con «Salir»; al guardar, a
 *   la pantalla pedida o al inicio.
 * - **voluntaria** (`/cambiar-contrasena`, desde el menú del usuario): dentro del layout, con
 *   «Cancelar»; al guardar, vuelve a la pantalla en la que estaba.
 *
 * Aquí solo la forma (llena, largo, las dos iguales). Si es común, trivial o contiene el usuario o
 * la empresa lo dice el backend al guardar, y su mensaje se muestra arriba del botón.
 */
@Component({
  selector: 'app-cambiar-contrasena',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    RouterLink,
    IconoComponent,
    MarcaComponent,
  ],
  templateUrl: './cambiar-contrasena.component.html',
  styleUrl: './cambiar-contrasena.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambiarContrasenaComponent {
  private readonly facade = inject(SesionFacade);
  private readonly avisos = inject(NotificacionesService);
  private readonly ruta = inject(ActivatedRoute).snapshot;
  private readonly volver = this.ruta.queryParamMap.get('volver');

  protected readonly temporal =
    (this.ruta.data as Partial<DatosRutaCambiarContrasena>).temporal === true;
  /** «Ana Pérez, el» (o «El» si no se sabe el nombre): empieza la explicación. */
  protected readonly saludo = computed(() => {
    const nombre = this.facade.nombreCompleto();
    return nombre === null ? 'El' : `${nombre}, el`;
  });
  /** «Cancelar» vuelve a la pantalla en la que estaba. */
  protected readonly destinoCancelar = inject(Router).parseUrl(destinoTrasIngreso(this.volver));

  protected readonly formulario = new FormGroup({
    actual: new FormControl('', { nonNullable: true, validators: [obligatorio] }),
    nueva: new FormControl('', { nonNullable: true, validators: [obligatorio, largoContrasena] }),
    repetir: new FormControl('', { nonNullable: true, validators: [obligatorio, igualALaNueva] }),
  });

  private readonly nueva = toSignal(this.formulario.controls.nueva.valueChanges, {
    initialValue: '',
  });
  private readonly repetir = toSignal(this.formulario.controls.repetir.valueChanges, {
    initialValue: '',
  });
  protected readonly fuerza = computed(() => fuerzaContrasena(this.nueva()));
  protected readonly largoValido = computed(() => largoDeContrasenaValido(this.nueva()));
  protected readonly coinciden = computed(
    () => this.nueva().length > 0 && this.nueva() === this.repetir(),
  );
  protected readonly rayas = [1, 2, 3, 4] as const;

  protected readonly enviando = signal(false);
  protected readonly saliendo = signal(false);
  protected readonly verContrasenas = signal(false);
  /** El mensaje del backend (o de la red), arriba del botón. */
  protected readonly error = signal<string | null>(null);

  private readonly campoActual = viewChild.required<ElementRef<HTMLInputElement>>('campoActual');
  private readonly campoNueva = viewChild.required<ElementRef<HTMLInputElement>>('campoNueva');
  private readonly campoRepetir = viewChild.required<ElementRef<HTMLInputElement>>('campoRepetir');

  constructor() {
    // Si cambia la nueva, «Repita…» se vuelve a revisar contra ella.
    this.formulario.controls.nueva.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.formulario.controls.repetir.updateValueAndValidity({ emitEvent: false }),
      );
  }

  protected alternarVerContrasenas(): void {
    this.verContrasenas.update((ver) => !ver);
  }

  protected async guardar(): Promise<void> {
    if (this.enviando()) return;
    this.error.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }
    this.enviando.set(true);
    try {
      const { actual, nueva } = this.formulario.getRawValue();
      await this.facade.cambiarContrasena({ actual, nueva }, this.volver);
      void this.avisos.exito('Contraseña cambiada');
    } catch (error) {
      this.error.set(error instanceof ErrorHttp ? error.message : MENSAJE_INESPERADO);
    } finally {
      this.enviando.set(false);
    }
  }

  /** Con la temporal, la única salida. Si falla (sin conexión), el aviso ya salió y sigue aquí. */
  protected async salir(): Promise<void> {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    try {
      await this.facade.salir();
    } catch {
      this.saliendo.set(false);
    }
  }

  private enfocarPrimerError(): void {
    const { actual, nueva } = this.formulario.controls;
    const campo = actual.invalid
      ? this.campoActual()
      : nueva.invalid
        ? this.campoNueva()
        : this.campoRepetir();
    campo.nativeElement.focus();
  }
}
