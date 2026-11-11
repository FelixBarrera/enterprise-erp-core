import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute } from '@angular/router';
import { ErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { obligatorio } from '../../../../../../shared/infrastructure/formularios/validadores';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import { MARCA } from '../../../../../../shared/infrastructure/layout/marca/marca';
import { MarcaComponent } from '../../../../../../shared/infrastructure/layout/marca/marca.component';
import { SesionFacade } from '../../../presentation/facades/sesion.facade';

const MENSAJE_INESPERADO = 'No se pudo ingresar. Intente de nuevo.';

/**
 * Login partido (docs/arquitectura-frontend.md, 8.5): la marca en azul oscuro a la izquierda y el
 * formulario a la derecha; en el celular, solo el formulario con la marca arriba. Fuera del layout.
 */
@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    IconoComponent,
    MarcaComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly facade = inject(SesionFacade);
  private readonly volver = inject(ActivatedRoute).snapshot.queryParamMap.get('volver');

  protected readonly formulario = new FormGroup({
    nombreUsuario: new FormControl('', { nonNullable: true, validators: [obligatorio] }),
    contrasena: new FormControl('', { nonNullable: true, validators: [obligatorio] }),
  });

  protected readonly marca = MARCA;
  protected readonly enviando = signal(false);
  protected readonly verContrasena = signal(false);
  /** El mensaje del backend (o de la red), arriba del botón. */
  protected readonly error = signal<string | null>(null);

  private readonly campoUsuario = viewChild.required<ElementRef<HTMLInputElement>>('campoUsuario');
  private readonly campoContrasena =
    viewChild.required<ElementRef<HTMLInputElement>>('campoContrasena');

  protected alternarVerContrasena(): void {
    this.verContrasena.update((ver) => !ver);
  }

  protected async entrar(): Promise<void> {
    if (this.enviando()) return;
    this.error.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }
    this.enviando.set(true);
    try {
      await this.facade.entrar(this.formulario.getRawValue(), this.volver);
    } catch (error) {
      this.error.set(error instanceof ErrorHttp ? error.message : MENSAJE_INESPERADO);
      // La contraseña se vuelve a escribir; el usuario queda.
      this.formulario.controls.contrasena.reset('');
      this.campoContrasena().nativeElement.focus();
    } finally {
      this.enviando.set(false);
    }
  }

  private enfocarPrimerError(): void {
    const campo = this.formulario.controls.nombreUsuario.invalid
      ? this.campoUsuario()
      : this.campoContrasena();
    campo.nativeElement.focus();
  }
}
