import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { iniciales } from '../../../../../../shared/domain/iniciales';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { ConfirmacionService } from '../../../../../../shared/infrastructure/avisos/confirmacion.service';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { FechaHoraPipe } from '../../../../../../shared/infrastructure/fechas/fecha-hora.pipe';
import { EncabezadoFichaComponent } from '../../../../../../shared/infrastructure/fichas/encabezado-ficha.component';
import { ConPermisoDirective } from '../../../../../../shared/infrastructure/permisos/con-permiso.directive';
import { PieFichaComponent } from '../../../../../../shared/infrastructure/fichas/pie-ficha.component';
import { obligatorio } from '../../../../../../shared/infrastructure/formularios/validadores';
import {
  IconoComponent,
  type NombreIcono,
} from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import { mostrarMigaActual } from '../../../../../../shared/infrastructure/layout/migas/migas.service';
import {
  CELULAR,
  segunPantalla,
} from '../../../../../../shared/infrastructure/layout/pantalla-chica';
import { USUARIO_CABECERA } from '../../../../../../shared/infrastructure/layout/usuario-cabecera';
import { BarraCargaComponent } from '../../../../../../shared/infrastructure/listados/barra-carga/barra-carga.component';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { ADMINISTRAR_USUARIOS_PORT } from '../../../../application/ports/in/administrar-usuarios.port';
import { CONSULTAR_USUARIOS_PORT } from '../../../../application/ports/in/consultar-usuarios.port';
import { RolesSinGuardarError } from '../../../../domain/errors/roles-sin-guardar.error';
import { textoCambiosSinGuardar } from '../../../../domain/rol';
import {
  type AccionUsuario,
  accionesDeUsuario,
  cambiosDeUsuario,
  cantidadDeCambiosDeRoles,
  describirNavegador,
  esAccionDePeligro,
  estadosDeUsuario,
  filasDeRoles,
  LARGO_MAXIMO_NOMBRE_COMPLETO,
  type ReglaRolesUsuario,
  type RolAsignable,
  rolesEnOrden,
  TEXTO_SIN_INGRESO,
  textoSesionesCerradas,
  type Usuario,
} from '../../../../domain/usuario';
import { AuthStore } from '../../../presentation/stores/auth.store';
import { ContrasenaTemporalService } from '../contrasena-temporal/contrasena-temporal.service';
import { EditorRolesUsuarioComponent } from '../editor-roles-usuario/editor-roles-usuario.component';

const MENSAJE_SIN_CARGAR = 'No se pudieron cargar los datos del usuario.';
const MENSAJE_SIN_GUARDAR = 'No se pudo guardar. Intente de nuevo.';
const MENSAJE_ROLES_SIN_GUARDAR = 'Se guardó el nombre, pero no los roles.';
const MENSAJE_SIN_ROLES = 'Debe tener al menos un rol. Para quitarle todos use «Quitar acceso».';

/** Cómo se ve cada acción del menú «Acciones» (su ícono, el mismo de la lista de roles si lo hay). */
const ACCIONES: Record<
  AccionUsuario,
  { readonly texto: string; readonly enCurso: string; readonly icono: NombreIcono }
> = {
  reactivar: { texto: 'Reactivar', enCurso: 'Reactivando…', icono: 'reactivar' },
  desbloquear: { texto: 'Desbloquear', enCurso: 'Desbloqueando…', icono: 'desbloquear' },
  'contrasena-temporal': {
    texto: 'Dar contraseña temporal',
    enCurso: 'Generando…',
    icono: 'llave',
  },
  'cerrar-sesiones': { texto: 'Cerrar sus sesiones', enCurso: 'Cerrando…', icono: 'salir' },
  'quitar-acceso': { texto: 'Quitar acceso', enCurso: 'Quitando…', icono: 'quitar-acceso' },
  desactivar: { texto: 'Desactivar', enCurso: 'Desactivando…', icono: 'desactivar' },
};

/** Las pestañas, en su orden. */
const PESTANA_DATOS = 0;

type Carga =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'error'; readonly mensaje: string; readonly reintentar: boolean }
  | { readonly estado: 'lista' };

/**
 * La ficha de un usuario (`/usuarios/:id`, con `auth.usuario.ver`), con el molde de la de roles:
 * pestañas «Datos» (el nombre, con `auth.usuario.editar`), «Roles» (con `auth.usuario.asignar_roles`;
 * lo que quien opera no puede dar, bloqueado con el motivo) y «Sesiones» (solo a la vista); una sola
 * barra «N cambios sin guardar» para el nombre y los roles. Arriba, el menú «Acciones» (6.12b3) con
 * las que tienen sentido para este usuario y quien opera (`accionesDeUsuario()`): reactivar,
 * desbloquear, dar una contraseña temporal (se ve en su ventana, una sola vez), cerrar sus sesiones
 * y, en rojo, quitar el acceso (vuelve a la lista) y desactivar. Las que cortan algo se confirman.
 * Una acción no toca lo escrito y sin guardar. En su propia ficha, los roles en solo lectura.
 */
@Component({
  selector: 'app-ficha-usuario',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatTabsModule,
    RouterLink,
    FechaHoraPipe,
    BarraCargaComponent,
    EncabezadoFichaComponent,
    IconoComponent,
    PieFichaComponent,
    ConPermisoDirective,
    EditorRolesUsuarioComponent,
  ],
  templateUrl: './ficha-usuario.component.html',
  styleUrl: './ficha-usuario.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FichaUsuarioComponent {
  private readonly consultar = inject(CONSULTAR_USUARIOS_PORT);
  private readonly administrar = inject(ADMINISTRAR_USUARIOS_PORT);
  private readonly permisos = inject(PERMISOS_SESION);
  private readonly sesion = inject(AuthStore).sesion;
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly contrasenaTemporal = inject(ContrasenaTemporalService);
  private readonly avisos = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly enCelular = segunPantalla(CELULAR);
  protected readonly nombreEmpresa = inject(USUARIO_CABECERA).nombreEmpresa;
  protected readonly pestana = signal(PESTANA_DATOS);

  protected readonly carga = signal<Carga>({ estado: 'cargando' });
  protected readonly falla = computed(() => {
    const carga = this.carga();
    return carga.estado === 'error' ? carga : null;
  });
  protected readonly usuario = signal<Usuario | null>(null);
  protected readonly asignables = signal<readonly RolAsignable[]>([]);
  /** Los roles marcados en «Roles» (lo guardado, hasta que se cambie algo). */
  protected readonly marcados = signal<ReadonlySet<string>>(new Set());
  private readonly originales = computed<ReadonlySet<string>>(
    () => new Set(this.usuario()?.roles.map((r) => r.id) ?? []),
  );

  protected readonly simbolo = computed(() => iniciales(this.usuario()?.nombreCompleto ?? ''));
  protected readonly estados = computed(() => {
    const usuario = this.usuario();
    return usuario === null ? [] : estadosDeUsuario(usuario);
  });
  protected readonly sinIngreso = TEXTO_SIN_INGRESO;
  protected readonly navegador = describirNavegador;

  /** Nadie cambia sus propios roles ni se quita el acceso a sí mismo. */
  protected readonly esSuFicha = computed(
    () => this.usuario() !== null && this.usuario()?.id === this.sesion()?.usuario.id,
  );
  protected readonly puedeEditarNombre = computed(() => this.permisos.tiene('auth.usuario.editar'));
  protected readonly regla = computed<ReglaRolesUsuario>(() => ({
    editable: !this.esSuFicha() && this.permisos.tiene('auth.usuario.asignar_roles'),
    esAdministrador: this.sesion()?.esAdministrador ?? false,
  }));
  /** Las del menú «Acciones», en su orden; las de peligro, aparte (van después de una línea). */
  protected readonly acciones = computed(() => {
    const usuario = this.usuario();
    if (usuario === null) return { comunes: [], peligro: [], hay: false };
    const todas = accionesDeUsuario(usuario, {
      esSuFicha: this.esSuFicha(),
      puedeRestablecer: this.permisos.tiene('auth.usuario.restablecer'),
      puedeDesactivar: this.permisos.tiene('auth.usuario.desactivar'),
      puedeQuitarAcceso: this.permisos.tiene('auth.usuario.asignar_roles'),
    });
    return {
      comunes: todas.filter((a) => !esAccionDePeligro(a)),
      peligro: todas.filter(esAccionDePeligro),
      hay: todas.length > 0,
    };
  });
  /** La acción que está en curso (una a la vez). */
  protected readonly enCurso = signal<AccionUsuario | null>(null);
  protected readonly textoMenu = computed(() => {
    const accion = this.enCurso();
    return accion === null ? 'Acciones' : ACCIONES[accion].enCurso;
  });
  protected readonly tituloRoles = computed(() => {
    const empresa = this.nombreEmpresa();
    return empresa === null ? 'Roles en esta empresa' : `Roles en ${empresa}`;
  });

  protected readonly nombre = new FormControl('', {
    nonNullable: true,
    validators: [obligatorio, Validators.maxLength(LARGO_MAXIMO_NOMBRE_COMPLETO)],
  });
  protected readonly formulario = new FormGroup({ nombre: this.nombre });
  protected readonly largoNombre = LARGO_MAXIMO_NOMBRE_COMPLETO;
  protected readonly mensajeSinRoles = MENSAJE_SIN_ROLES;
  private readonly nombreEscrito = toSignal(this.nombre.valueChanges, {
    initialValue: this.nombre.value,
  });
  protected readonly sinRoles = computed(
    () => this.regla().editable && this.usuario() !== null && this.marcados().size === 0,
  );
  protected readonly cantidadCambios = computed(() => {
    const usuario = this.usuario();
    if (usuario === null) return 0;
    const nombre =
      this.puedeEditarNombre() && cambiosDeUsuario(usuario, this.nombreEscrito()) !== null ? 1 : 0;
    const roles = this.regla().editable
      ? cantidadDeCambiosDeRoles(this.marcados(), this.originales())
      : 0;
    return nombre + roles;
  });
  protected readonly textoCambios = computed(() => textoCambiosSinGuardar(this.cantidadCambios()));

  protected readonly guardando = signal(false);
  /** El mensaje del backend al guardar (o de la red), en la barra de cambios. */
  protected readonly error = signal<string | null>(null);

  private readonly campoNombre = viewChild<ElementRef<HTMLInputElement>>('campoNombre');
  private id = '';

  constructor() {
    mostrarMigaActual(() => this.usuario()?.nombreCompleto ?? null);
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
      const [usuario, asignables] = await Promise.all([
        this.consultar.ver(this.id),
        this.consultar.rolesAsignables(),
      ]);
      this.asignables.set(asignables);
      this.mostrar(usuario);
      this.carga.set({ estado: 'lista' });
    } catch (error) {
      this.carga.set({ estado: 'error', ...falloAlCargar(error) });
    }
  }

  protected async guardar(): Promise<void> {
    const usuario = this.usuario();
    if (this.guardando() || usuario === null || this.cantidadCambios() === 0) return;
    this.error.set(null);
    if (this.puedeEditarNombre() && this.nombre.invalid) {
      this.nombre.markAsTouched();
      this.enfocarNombre();
      return;
    }
    // La barra ya lo dice y «Guardar» está deshabilitado.
    if (this.sinRoles()) return;
    const filas = filasDeRoles(this.asignables(), usuario.roles, this.marcados(), this.regla());
    const roles = this.regla().editable
      ? rolesEnOrden(filas, this.marcados())
      : usuario.roles.map((r) => r.id);
    const nombre = this.puedeEditarNombre() ? this.nombre.value : usuario.nombreCompleto;
    this.guardando.set(true);
    try {
      const guardado = await this.administrar.guardar(usuario, nombre, roles);
      if (guardado === null) return;
      this.mostrar(guardado);
      void this.avisos.exito('Usuario actualizado');
    } catch (error) {
      if (error instanceof RolesSinGuardarError) {
        this.mostrarDatos(error.usuario);
        this.error.set(`${MENSAJE_ROLES_SIN_GUARDAR} ${mensajeDeError(error.causa)}`.trim());
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
    const usuario = this.usuario();
    if (usuario !== null) this.mostrar(usuario);
  }

  /** El texto y el ícono de una acción del menú. */
  protected verAccion(accion: AccionUsuario): { texto: string; icono: NombreIcono } {
    const { texto, icono } = ACCIONES[accion];
    if (accion === 'cerrar-sesiones' && this.esSuFicha()) {
      return { texto: 'Cerrar sus otras sesiones', icono };
    }
    return { texto, icono };
  }

  protected async ejecutar(accion: AccionUsuario): Promise<void> {
    const usuario = this.usuario();
    if (usuario === null || this.enCurso() !== null) return;
    const confirmacion = this.confirmacionDe(accion, usuario);
    if (confirmacion !== null && !(await this.confirmacion.confirmar(confirmacion))) return;
    this.enCurso.set(accion);
    try {
      await this.hacer(accion, usuario);
    } catch (error) {
      if (error instanceof ErrorHttp && !error.avisado) void this.avisos.error(error.message);
      else if (!(error instanceof ErrorHttp)) void this.avisos.error(MENSAJE_SIN_GUARDAR);
    } finally {
      this.enCurso.set(null);
    }
  }

  private async hacer(accion: AccionUsuario, usuario: Usuario): Promise<void> {
    switch (accion) {
      case 'reactivar':
        this.usuario.set(await this.administrar.reactivar(usuario.id));
        void this.avisos.exito('Usuario reactivado');
        return;
      case 'desbloquear':
        this.usuario.set(await this.administrar.desbloquear(usuario.id));
        void this.avisos.exito('Usuario desbloqueado');
        return;
      case 'contrasena-temporal': {
        const dada = await this.administrar.darContrasenaTemporal(usuario.id);
        this.usuario.set(dada.usuario);
        await this.contrasenaTemporal.mostrar({
          titulo: 'Contraseña temporal nueva',
          nombreUsuario: dada.usuario.nombreUsuario,
          contrasena: dada.contrasenaTemporal,
          textoListo: 'Listo',
        });
        return;
      }
      case 'cerrar-sesiones': {
        const { sesionesCerradas } = await this.administrar.cerrarSesiones(usuario.id);
        void this.avisos.exito(textoSesionesCerradas(sesionesCerradas, this.esSuFicha()));
        await this.refrescar();
        return;
      }
      case 'quitar-acceso':
        await this.administrar.quitarAcceso(usuario.id);
        void this.avisos.exito('Acceso quitado');
        // Ya no es de esta empresa: su ficha respondería 404.
        void this.router.navigateByUrl('/usuarios', { replaceUrl: true });
        return;
      case 'desactivar':
        this.usuario.set(await this.administrar.desactivar(usuario.id));
        void this.avisos.exito('Usuario desactivado');
        return;
    }
  }

  /** Las que cortan algo se confirman; desbloquear y reactivar, no (decisión del usuario). */
  private confirmacionDe(
    accion: AccionUsuario,
    usuario: Usuario,
  ): { titulo: string; mensaje: string; textoConfirmar: string; peligro?: boolean } | null {
    const empresa = this.nombreEmpresa();
    switch (accion) {
      case 'contrasena-temporal':
        return {
          titulo: 'Dar una contraseña temporal',
          mensaje: mensajeContrasenaTemporal(usuario),
          textoConfirmar: 'Dar contraseña temporal',
        };
      case 'cerrar-sesiones':
        return {
          titulo: this.esSuFicha() ? 'Cerrar sus otras sesiones' : 'Cerrar sus sesiones',
          mensaje: mensajeCerrarSesiones(usuario, this.esSuFicha()),
          textoConfirmar: 'Cerrar sesiones',
        };
      case 'quitar-acceso':
        return {
          titulo: 'Quitar el acceso',
          mensaje: mensajeQuitarAcceso(usuario, empresa),
          textoConfirmar: 'Quitar acceso',
          peligro: true,
        };
      case 'desactivar':
        return {
          titulo: 'Desactivar el usuario',
          mensaje: mensajeDesactivar(usuario),
          textoConfirmar: 'Desactivar',
          peligro: true,
        };
      case 'reactivar':
      case 'desbloquear':
        return null;
    }
  }

  /** Las sesiones cambiaron: se piden otra vez. Si falla, la ficha queda como estaba. */
  private async refrescar(): Promise<void> {
    try {
      this.usuario.set(await this.consultar.ver(this.id));
    } catch {
      // El aviso de la acción ya salió; lo de la ficha se ve al volver a abrirla.
    }
  }

  /** Lo guardado: el nombre y los roles. */
  private mostrar(usuario: Usuario): void {
    this.mostrarDatos(usuario);
    this.marcados.set(new Set(usuario.roles.map((r) => r.id)));
  }

  /** Solo los datos: los roles marcados quedan como están. */
  private mostrarDatos(usuario: Usuario): void {
    this.usuario.set(usuario);
    this.nombre.reset(usuario.nombreCompleto);
    this.error.set(null);
  }

  /** El error está en «Datos»: se va a esa pestaña y, ya dibujada, al campo. */
  private enfocarNombre(): void {
    this.pestana.set(PESTANA_DATOS);
    afterNextRender(() => this.campoNombre()?.nativeElement.focus(), { injector: this.injector });
  }
}

/** El mensaje que trae el backend (si no se avisó ya), o vacío. */
function mensajeDeError(error: unknown): string {
  return error instanceof ErrorHttp && !error.avisado ? error.message : '';
}

function mensajeContrasenaTemporal(usuario: Usuario): string {
  const bloqueo = usuario.bloqueadoHasta === null ? '' : ' También se quita el bloqueo.';
  return (
    `El sistema genera una contraseña nueva para ${usuario.nombreCompleto} y se la muestra una ` +
    `sola vez. La que usa ahora deja de servir, se cierran sus sesiones en todas sus empresas y, ` +
    `al entrar, deberá cambiarla.${bloqueo}`
  );
}

function mensajeCerrarSesiones(usuario: Usuario, esSuFicha: boolean): string {
  if (esSuFicha) {
    return 'Se cierran sus sesiones en los demás equipos y en todas sus empresas. Esta sigue abierta.';
  }
  const donde = usuario.trabajaEnOtrasEmpresas
    ? 'en todas sus empresas, no solo en esta'
    : 'en todos sus equipos';
  return (
    `${usuario.nombreCompleto} tendrá que volver a entrar: se cierran sus sesiones ${donde}. ` +
    'Sirve si perdió un equipo o se lo robaron.'
  );
}

function mensajeDesactivar(usuario: Usuario): string {
  const otras = usuario.trabajaEnOtrasEmpresas ? ' Tampoco entra a sus otras empresas.' : '';
  return (
    `${usuario.nombreCompleto} no podrá entrar y se cierran sus sesiones.${otras} Sus roles y su ` +
    'historia quedan: si se reactiva, vuelve con los mismos roles.'
  );
}

function mensajeQuitarAcceso(usuario: Usuario, empresa: string | null): string {
  const donde = empresa === null ? 'esta empresa' : empresa;
  const otras = usuario.trabajaEnOtrasEmpresas ? ' Sus otras empresas no cambian.' : '';
  return (
    `${usuario.nombreCompleto} deja de entrar a ${donde}: se le quitan sus roles aquí y se ` +
    `cierran sus sesiones en esta empresa.${otras}`
  );
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
