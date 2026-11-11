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
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink } from '@angular/router';
import { ErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { EncabezadoFichaComponent } from '../../../../../../shared/infrastructure/fichas/encabezado-ficha.component';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import { mostrarMigaActual } from '../../../../../../shared/infrastructure/layout/migas/migas.service';
import {
  CELULAR,
  segunPantalla,
} from '../../../../../../shared/infrastructure/layout/pantalla-chica';
import { BarraCargaComponent } from '../../../../../../shared/infrastructure/listados/barra-carga/barra-carga.component';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { ADMINISTRAR_ROLES_PORT } from '../../../../application/ports/in/administrar-roles.port';
import { CONSULTAR_ROLES_PORT } from '../../../../application/ports/in/consultar-roles.port';
import {
  codigosDelCatalogo,
  type GrupoPermisos,
  permisosEnOrden,
  textoMarcados,
} from '../../../../domain/permisos-rol';
import { crearFormularioRol, DatosRolComponent } from '../datos-rol/datos-rol.component';
import { EditorPermisosComponent } from '../editor-permisos/editor-permisos.component';

const MENSAJE_SIN_CARGAR = 'No se pudo cargar la lista de permisos.';
const MENSAJE_SIN_GUARDAR = 'No se pudo registrar el rol. Intente de nuevo.';
const PESTANA_DATOS = 0;

type Carga = 'cargando' | 'error' | 'lista';

/**
 * «Nuevo rol» (`/roles/nuevo`, con `auth.rol.crear`): las mismas pestañas que la ficha, «Datos» y
 * «Permisos», y se guarda todo junto en una sola petición. Al registrarlo abre su ficha (sin dejar
 * el alta en el historial).
 */
@Component({
  selector: 'app-nuevo-rol',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatTabsModule,
    RouterLink,
    BarraCargaComponent,
    EncabezadoFichaComponent,
    IconoComponent,
    DatosRolComponent,
    EditorPermisosComponent,
  ],
  templateUrl: './nuevo-rol.component.html',
  styleUrl: './nuevo-rol.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevoRolComponent {
  private readonly consultar = inject(CONSULTAR_ROLES_PORT);
  private readonly administrar = inject(ADMINISTRAR_ROLES_PORT);
  private readonly permisos = inject(PERMISOS_SESION);
  private readonly avisos = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly enCelular = segunPantalla(CELULAR);
  protected readonly pestana = signal(PESTANA_DATOS);
  protected readonly carga = signal<Carga>('cargando');
  protected readonly mensajeSinCargar = MENSAJE_SIN_CARGAR;

  protected readonly formulario = crearFormularioRol();
  protected readonly catalogo = signal<readonly GrupoPermisos[]>([]);
  protected readonly marcados = signal<ReadonlySet<string>>(new Set());
  protected readonly textoPermisos = computed(() =>
    textoMarcados(this.marcados().size, codigosDelCatalogo(this.catalogo()).length),
  );
  protected readonly puedeDar = (codigo: string): boolean => this.permisos.tiene(codigo);

  protected readonly registrando = signal(false);
  /** El mensaje del backend (o de la red), arriba de los botones. */
  protected readonly error = signal<string | null>(null);

  private readonly datos = viewChild(DatosRolComponent);

  constructor() {
    mostrarMigaActual(() => 'Nuevo rol');
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.carga.set('cargando');
    try {
      this.catalogo.set(await this.consultar.catalogo());
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
      this.pestana.set(PESTANA_DATOS);
      afterNextRender(() => this.datos()?.enfocarPrimerError(), { injector: this.injector });
      return;
    }
    this.registrando.set(true);
    try {
      const rol = await this.administrar.crear(
        this.formulario.getRawValue(),
        permisosEnOrden(this.catalogo(), this.marcados()),
      );
      void this.avisos.exito('Rol creado');
      await this.router.navigate(['/roles', rol.id], { replaceUrl: true });
    } catch (error) {
      if (error instanceof ErrorHttp && error.avisado) return;
      this.error.set(error instanceof ErrorHttp ? error.message : MENSAJE_SIN_GUARDAR);
    } finally {
      this.registrando.set(false);
    }
  }
}
