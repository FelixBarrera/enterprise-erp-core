import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { ConfirmacionService } from '../../../../../../shared/infrastructure/avisos/confirmacion.service';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { EncabezadoFichaComponent } from '../../../../../../shared/infrastructure/fichas/encabezado-ficha.component';
import { ConPermisoDirective } from '../../../../../../shared/infrastructure/permisos/con-permiso.directive';
import { PieFichaComponent } from '../../../../../../shared/infrastructure/fichas/pie-ficha.component';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import {
  CELULAR,
  segunPantalla,
} from '../../../../../../shared/infrastructure/layout/pantalla-chica';
import { mostrarMigaActual } from '../../../../../../shared/infrastructure/layout/migas/migas.service';
import { BarraCargaComponent } from '../../../../../../shared/infrastructure/listados/barra-carga/barra-carga.component';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { ADMINISTRAR_ROLES_PORT } from '../../../../application/ports/in/administrar-roles.port';
import { CONSULTAR_ROLES_PORT } from '../../../../application/ports/in/consultar-roles.port';
import { PermisosSinGuardarError } from '../../../../domain/errors/permisos-sin-guardar.error';
import {
  cantidadDeCambiosDePermisos,
  codigosDelCatalogo,
  type GrupoPermisos,
  permisosEnOrden,
  textoMarcados,
} from '../../../../domain/permisos-rol';
import {
  cambiosDeRol,
  cantidadDeCambios,
  type Rol,
  textoCambiosSinGuardar,
  textoUsuariosDelRol,
} from '../../../../domain/rol';
import { crearFormularioRol, DatosRolComponent } from '../datos-rol/datos-rol.component';
import { EditorPermisosComponent } from '../editor-permisos/editor-permisos.component';

const MENSAJE_SIN_CARGAR = 'No se pudieron cargar los datos del rol.';
const MENSAJE_SIN_GUARDAR = 'No se pudo guardar. Intente de nuevo.';
const MENSAJE_PERMISOS_SIN_GUARDAR = 'Se guardaron los datos del rol, pero no los permisos.';

/** Las pestañas, en su orden. */
const PESTANA_DATOS = 0;

type Carga =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'error'; readonly mensaje: string; readonly reintentar: boolean }
  | { readonly estado: 'lista' };

/**
 * La ficha de un rol (`/roles/:id`, con `auth.rol.ver`). Siempre editable con `auth.rol.editar`
 * (decisión del usuario): al cambiar algo aparece la barra «N cambios sin guardar» con
 * «Descartar» y «Guardar cambios», que manda solo lo que cambió. El Administrador se ve en solo
 * lectura, sin «Desactivar». Sin el permiso de editar, también en solo lectura. «Desactivar» se
 * confirma; un rol desactivado muestra «Reactivar».
 *
 * Dos pestañas (6.12a3): «Datos» y «Permisos» (por módulo, con «N de M»), con una sola barra de
 * cambios para las dos. Se guardan primero los datos y luego los permisos; si lo segundo falla, los
 * datos quedan guardados y los permisos, pendientes con el mensaje en la barra.
 */
@Component({
  selector: 'app-ficha-rol',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatTabsModule,
    RouterLink,
    BarraCargaComponent,
    EncabezadoFichaComponent,
    IconoComponent,
    PieFichaComponent,
    ConPermisoDirective,
    DatosRolComponent,
    EditorPermisosComponent,
  ],
  templateUrl: './ficha-rol.component.html',
  styleUrl: './ficha-rol.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FichaRolComponent {
  private readonly consultar = inject(CONSULTAR_ROLES_PORT);
  private readonly administrar = inject(ADMINISTRAR_ROLES_PORT);
  private readonly permisos = inject(PERMISOS_SESION);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly avisos = inject(NotificacionesService);
  private readonly injector = inject(Injector);

  protected readonly enCelular = segunPantalla(CELULAR);
  protected readonly pestana = signal(PESTANA_DATOS);

  protected readonly carga = signal<Carga>({ estado: 'cargando' });
  protected readonly falla = computed(() => {
    const carga = this.carga();
    return carga.estado === 'error' ? carga : null;
  });
  protected readonly rol = signal<Rol | null>(null);
  protected readonly catalogo = signal<readonly GrupoPermisos[]>([]);
  /** Los permisos marcados en la pestaña «Permisos» (lo guardado, hasta que se cambie algo). */
  protected readonly marcados = signal<ReadonlySet<string>>(new Set());
  protected readonly originales = computed<ReadonlySet<string>>(
    () => new Set(this.rol()?.permisos ?? []),
  );
  protected readonly textoPermisos = computed(() =>
    textoMarcados(this.marcados().size, codigosDelCatalogo(this.catalogo()).length),
  );
  /** Para la escalada: lo que quien opera puede dar (el administrador, todo). */
  protected readonly puedeDar = (codigo: string): boolean => this.permisos.tiene(codigo);
  protected readonly textoUsuarios = computed(() =>
    textoUsuariosDelRol(this.rol()?.cantidadUsuarios ?? 0),
  );

  /** Con el permiso y si no es el Administrador (ese no se cambia). */
  protected readonly puedeEditar = computed(() => {
    const rol = this.rol();
    return rol !== null && !rol.esAdministrador && this.permisos.tiene('auth.rol.editar');
  });
  protected readonly puedeDesactivar = computed(() => {
    const rol = this.rol();
    return rol !== null && !rol.esAdministrador && this.permisos.tiene('auth.rol.desactivar');
  });

  protected readonly formulario = crearFormularioRol();
  private readonly escritos = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });
  protected readonly cantidadCambios = computed(() => {
    const rol = this.rol();
    if (rol === null || !this.puedeEditar()) return 0;
    const { nombre = '', descripcion = '' } = this.escritos();
    return (
      cantidadDeCambios(cambiosDeRol(rol, { nombre, descripcion })) +
      cantidadDeCambiosDePermisos(this.marcados(), this.originales())
    );
  });
  protected readonly textoBotonEstado = computed(() => {
    const activo = this.rol()?.activo ?? true;
    if (this.cambiandoEstado()) return activo ? 'Desactivando…' : 'Reactivando…';
    return activo ? 'Desactivar' : 'Reactivar';
  });
  protected readonly textoCambios = computed(() => textoCambiosSinGuardar(this.cantidadCambios()));

  protected readonly guardando = signal(false);
  /** Desactivar o reactivar en curso. */
  protected readonly cambiandoEstado = signal(false);
  /** El mensaje del backend al guardar (o de la red), en la barra de cambios. */
  protected readonly error = signal<string | null>(null);

  private readonly datos = viewChild(DatosRolComponent);
  private id = '';

  constructor() {
    mostrarMigaActual(() => this.rol()?.nombre ?? null);
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((parametros) => {
        this.id = parametros.get('id') ?? '';
        void this.cargar();
      });
  }

  protected async cargar(): Promise<void> {
    this.carga.set({ estado: 'cargando' });
    try {
      const catalogo = this.catalogo().length > 0 ? this.catalogo() : this.consultar.catalogo();
      const [rol, grupos] = await Promise.all([this.consultar.ver(this.id), catalogo]);
      this.catalogo.set(grupos);
      this.mostrar(rol);
      this.carga.set({ estado: 'lista' });
    } catch (error) {
      this.carga.set({ estado: 'error', ...falloAlCargar(error) });
    }
  }

  protected async guardar(): Promise<void> {
    const rol = this.rol();
    if (this.guardando() || rol === null || !this.puedeEditar()) return;
    this.error.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }
    this.guardando.set(true);
    try {
      const guardado = await this.administrar.guardar(
        rol,
        this.formulario.getRawValue(),
        permisosEnOrden(this.catalogo(), this.marcados()),
      );
      if (guardado === null) return;
      this.mostrar(guardado);
      void this.avisos.exito('Rol actualizado');
    } catch (error) {
      if (error instanceof PermisosSinGuardarError) {
        this.mostrarDatos(error.rol);
        this.error.set(`${MENSAJE_PERMISOS_SIN_GUARDAR} ${mensajeDeError(error.causa)}`.trim());
        return;
      }
      if (error instanceof ErrorHttp && error.avisado) return;
      this.error.set(mensajeDeError(error) || MENSAJE_SIN_GUARDAR);
    } finally {
      this.guardando.set(false);
    }
  }

  /** Vuelve a lo guardado. */
  protected descartar(): void {
    const rol = this.rol();
    if (rol !== null) this.mostrar(rol);
  }

  protected async desactivar(): Promise<void> {
    const rol = this.rol();
    if (rol === null || this.cambiandoEstado()) return;
    const confirmado = await this.confirmacion.confirmar({
      titulo: 'Desactivar el rol',
      mensaje: mensajeDesactivar(rol),
      textoConfirmar: 'Desactivar',
      peligro: true,
    });
    if (!confirmado) return;
    await this.cambiarEstado(() => this.administrar.desactivar(rol.id), 'Rol desactivado');
  }

  protected async reactivar(): Promise<void> {
    const rol = this.rol();
    if (rol === null || this.cambiandoEstado()) return;
    await this.cambiarEstado(() => this.administrar.reactivar(rol.id), 'Rol reactivado');
  }

  /** Lo escrito y no guardado se conserva: solo cambia el estado del rol. */
  private async cambiarEstado(accion: () => Promise<Rol>, aviso: string): Promise<void> {
    this.cambiandoEstado.set(true);
    try {
      const rol = await accion();
      if (this.cantidadCambios() === 0) this.mostrar(rol);
      else this.rol.set(rol);
      void this.avisos.exito(aviso);
    } catch (error) {
      if (error instanceof ErrorHttp && !error.avisado) void this.avisos.error(error.message);
      else if (!(error instanceof ErrorHttp)) void this.avisos.error(MENSAJE_SIN_GUARDAR);
    } finally {
      this.cambiandoEstado.set(false);
    }
  }

  /** Lo guardado: datos y permisos. */
  private mostrar(rol: Rol): void {
    this.mostrarDatos(rol);
    this.marcados.set(new Set(rol.permisos));
  }

  /** Solo los datos: los permisos marcados quedan como están. */
  private mostrarDatos(rol: Rol): void {
    this.rol.set(rol);
    this.formulario.reset({ nombre: rol.nombre, descripcion: rol.descripcion ?? '' });
    this.error.set(null);
  }

  /** El error está en «Datos»: se va a esa pestaña y, ya dibujada, al primer campo con error. */
  private enfocarPrimerError(): void {
    this.pestana.set(PESTANA_DATOS);
    afterNextRender(() => this.datos()?.enfocarPrimerError(), { injector: this.injector });
  }
}

/** El mensaje que trae el backend (si no se avisó ya), o vacío. */
function mensajeDeError(error: unknown): string {
  return error instanceof ErrorHttp && !error.avisado ? error.message : '';
}

function mensajeDesactivar(rol: Rol): string {
  const quienes =
    rol.cantidadUsuarios === 0
      ? 'Nadie lo tiene ahora.'
      : rol.cantidadUsuarios === 1
        ? 'La persona que lo tiene lo conserva, sin sus permisos, por si se reactiva.'
        : `Las ${rol.cantidadUsuarios} personas que lo tienen lo conservan, sin sus permisos, por si se reactiva.`;
  return `«${rol.nombre}» deja de dar sus permisos. ${quienes}`;
}

/** 400 (id mal escrito) y 404 traen su mensaje; sin red o del servidor, uno general y «Reintentar». */
function falloAlCargar(error: unknown): { mensaje: string; reintentar: boolean } {
  if (
    error instanceof ErrorHttp &&
    (error.tipo === TipoErrorHttp.NO_ENCONTRADO || error.tipo === TipoErrorHttp.VALIDACION)
  ) {
    return { mensaje: error.message, reintentar: false };
  }
  return { mensaje: MENSAJE_SIN_CARGAR, reintentar: true };
}
