import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { EncabezadoFichaComponent } from '../../../../../../shared/infrastructure/fichas/encabezado-ficha.component';
import { obligatorio } from '../../../../../../shared/infrastructure/formularios/validadores';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import { mostrarMigaActual } from '../../../../../../shared/infrastructure/layout/migas/migas.service';
import { USUARIO_CABECERA } from '../../../../../../shared/infrastructure/layout/usuario-cabecera';
import { BarraCargaComponent } from '../../../../../../shared/infrastructure/listados/barra-carga/barra-carga.component';
import { ADMINISTRAR_USUARIOS_PORT } from '../../../../application/ports/in/administrar-usuarios.port';
import { CONSULTAR_USUARIOS_PORT } from '../../../../application/ports/in/consultar-usuarios.port';
import {
  esNombreUsuarioValido,
  filasDeRoles,
  LARGO_MAXIMO_NOMBRE_COMPLETO,
  LARGO_MAXIMO_NOMBRE_USUARIO,
  type ReglaRolesUsuario,
  type RolAsignable,
  rolesEnOrden,
} from '../../../../domain/usuario';
import { AuthStore } from '../../../presentation/stores/auth.store';
import { ContrasenaTemporalService } from '../contrasena-temporal/contrasena-temporal.service';
import { EditorRolesUsuarioComponent } from '../editor-roles-usuario/editor-roles-usuario.component';

const MENSAJE_SIN_CARGAR = 'No se pudo cargar la lista de roles.';
const MENSAJE_SIN_GUARDAR = 'No se pudo registrar el usuario. Intente de nuevo.';
const MENSAJE_SIN_ROLES = 'Elija al menos un rol.';
/** El 409 de `POST /usuarios`: un nombre de usuario nunca se reutiliza (AUTH-D3). */
const MENSAJE_YA_EXISTE =
  'Ese nombre de usuario ya existe (aunque esté desactivado, no se vuelve a usar). Elija otro.';

const AYUDA_USUARIO =
  'Con este nombre entra. En minúsculas, de 3 a 50: letras, números, punto, guion y guion bajo. No se puede cambiar después.';

type Carga = 'cargando' | 'error' | 'lista';

/** Mismo formato que el backend (`NombreUsuario`); vacío lo dice `obligatorio`. */
function formatoNombreUsuario(control: AbstractControl<string>): ValidationErrors | null {
  const valor = control.value.trim();
  return valor === '' || esNombreUsuarioValido(valor) ? null : { formato: true };
}

/**
 * «Nuevo usuario» (`/usuarios/nuevo`, con `auth.usuario.crear`; tableros 9 y 10 de la maqueta):
 * una persona nueva, que se crea con una contraseña temporal (se muestra una sola vez, con
 * «Copiar») y al menos un rol, con la misma pestaña «Roles» de la ficha. Al terminar abre su ficha
 * (sin dejar el alta en el historial). Dar acceso a alguien que ya tiene usuario en otra empresa
 * se quitó (decisión del usuario, 2026-11-07).
 */
@Component({
  selector: 'app-nuevo-usuario',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
    BarraCargaComponent,
    EncabezadoFichaComponent,
    IconoComponent,
    EditorRolesUsuarioComponent,
  ],
  templateUrl: './nuevo-usuario.component.html',
  styleUrl: './nuevo-usuario.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevoUsuarioComponent {
  private readonly consultar = inject(CONSULTAR_USUARIOS_PORT);
  private readonly administrar = inject(ADMINISTRAR_USUARIOS_PORT);
  private readonly sesion = inject(AuthStore).sesion;
  private readonly contrasena = inject(ContrasenaTemporalService);
  private readonly router = inject(Router);

  protected readonly nombreEmpresa = inject(USUARIO_CABECERA).nombreEmpresa;
  protected readonly carga = signal<Carga>('cargando');
  protected readonly mensajeSinCargar = MENSAJE_SIN_CARGAR;

  protected readonly ayudaUsuario = AYUDA_USUARIO;
  protected readonly textoBoton = computed(() =>
    this.registrando() ? 'Registrando…' : 'Registrar usuario',
  );

  protected readonly formulario = new FormGroup({
    nombreUsuario: new FormControl('', {
      nonNullable: true,
      validators: [obligatorio, formatoNombreUsuario],
    }),
    nombreCompleto: new FormControl('', {
      nonNullable: true,
      validators: [obligatorio, Validators.maxLength(LARGO_MAXIMO_NOMBRE_COMPLETO)],
    }),
  });
  protected readonly largoUsuario = LARGO_MAXIMO_NOMBRE_USUARIO;
  protected readonly largoNombre = LARGO_MAXIMO_NOMBRE_COMPLETO;

  protected readonly asignables = signal<readonly RolAsignable[]>([]);
  protected readonly marcados = signal<ReadonlySet<string>>(new Set());
  protected readonly sinRoles = computed(() => this.marcados().size === 0);
  protected readonly regla = computed<ReglaRolesUsuario>(() => ({
    editable: true,
    esAdministrador: this.sesion()?.esAdministrador ?? false,
  }));
  protected readonly tituloRoles = computed(() => {
    const empresa = this.nombreEmpresa();
    return empresa === null ? 'Roles en esta empresa' : `Roles en ${empresa}`;
  });
  protected readonly detalle = computed(() => {
    const empresa = this.nombreEmpresa();
    return `Se crea con una contraseña temporal y al menos un rol en ${empresa ?? 'esta empresa'}.`;
  });

  protected readonly registrando = signal(false);
  /** El mensaje del backend (o de la red), arriba de los botones. */
  protected readonly error = signal<string | null>(null);

  private readonly campoUsuario = viewChild<ElementRef<HTMLInputElement>>('campoUsuario');
  private readonly campoNombre = viewChild<ElementRef<HTMLInputElement>>('campoNombre');

  constructor() {
    mostrarMigaActual(() => 'Nuevo usuario');
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.carga.set('cargando');
    try {
      this.asignables.set(await this.consultar.rolesAsignables());
      this.carga.set('lista');
    } catch {
      this.carga.set('error');
    }
  }

  protected async registrar(): Promise<void> {
    if (this.registrando()) return;
    this.error.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }
    if (this.sinRoles()) {
      // Va en la barra de abajo, que siempre está a la vista.
      this.error.set(MENSAJE_SIN_ROLES);
      return;
    }
    const filas = filasDeRoles(this.asignables(), [], this.marcados(), this.regla());
    const roles = rolesEnOrden(filas, this.marcados());
    const { nombreUsuario, nombreCompleto } = this.formulario.getRawValue();
    this.registrando.set(true);
    let terminado = false;
    try {
      const creado = await this.administrar.crear({ nombreUsuario, nombreCompleto, roles });
      terminado = true;
      await this.contrasena.mostrar({
        titulo: 'Usuario creado',
        nombreUsuario: creado.usuario.nombreUsuario,
        contrasena: creado.contrasenaTemporal,
        textoListo: 'Listo, ir a su ficha',
      });
      await this.abrirFicha(creado.usuario.id);
    } catch (error) {
      if (terminado) return;
      if (error instanceof ErrorHttp && error.avisado) return;
      if (error instanceof ErrorHttp && error.tipo === TipoErrorHttp.CONFLICTO) {
        this.error.set(MENSAJE_YA_EXISTE);
        return;
      }
      this.error.set(error instanceof ErrorHttp ? error.message : MENSAJE_SIN_GUARDAR);
    } finally {
      // Ya creado: la pantalla queda bloqueada hasta irse (que nadie lo registre dos veces).
      if (!terminado) this.registrando.set(false);
    }
  }

  private abrirFicha(id: string): Promise<boolean> {
    return this.router.navigate(['/usuarios', id], { replaceUrl: true });
  }

  private enfocarPrimerError(): void {
    const campo = this.formulario.controls.nombreUsuario.invalid
      ? this.campoUsuario()
      : this.campoNombre();
    campo?.nativeElement.focus();
  }
}
