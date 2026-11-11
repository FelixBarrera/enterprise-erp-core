import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { iniciales } from '../../../../../../shared/domain/iniciales';
import { FechaHoraPipe } from '../../../../../../shared/infrastructure/fechas/fecha-hora.pipe';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import {
  CELULAR,
  segunPantalla,
} from '../../../../../../shared/infrastructure/layout/pantalla-chica';
import { USUARIO_CABECERA } from '../../../../../../shared/infrastructure/layout/usuario-cabecera';
import { BarraCargaComponent } from '../../../../../../shared/infrastructure/listados/barra-carga/barra-carga.component';
import { EstadoListaComponent } from '../../../../../../shared/infrastructure/listados/estado-lista/estado-lista.component';
import { crearListado } from '../../../../../../shared/infrastructure/listados/listado';
import { PaginadorComponent } from '../../../../../../shared/infrastructure/listados/paginador/paginador.component';
import { ConPermisoDirective } from '../../../../../../shared/infrastructure/permisos/con-permiso.directive';
import { CONSULTAR_USUARIOS_PORT } from '../../../../application/ports/in/consultar-usuarios.port';
import {
  type EstadoFiltroUsuario,
  estadosDeUsuario,
  LARGO_MAXIMO_BUSQUEDA_USUARIO,
  type RolAsignable,
  TEXTO_SIN_INGRESO,
  textoRolDeUsuario,
  textoRolesDeUsuario,
  type UsuarioResumen,
} from '../../../../domain/usuario';
import { filtrosUsuariosAUrl, filtrosUsuariosDeUrl } from './filtros-url';

/** Las opciones de «Estado», en el orden en que se ven. */
const OPCIONES_ESTADO: readonly { readonly valor: EstadoFiltroUsuario; readonly texto: string }[] =
  [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'activos', texto: 'Activos' },
    { valor: 'desactivados', texto: 'Desactivados' },
  ];

/**
 * La lista de usuarios de la empresa activa (`/usuarios`, con `auth.usuario.ver`): buscar por
 * nombre o usuario y filtrar por rol y estado, con todo en la URL. Toda la fila abre la ficha. En
 * el celular, tarjetas y los filtros detrás del botón «Filtros». «Nuevo usuario», con
 * `auth.usuario.crear`.
 */
@Component({
  selector: 'app-lista-usuarios',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
    FechaHoraPipe,
    IconoComponent,
    BarraCargaComponent,
    EstadoListaComponent,
    PaginadorComponent,
    ConPermisoDirective,
  ],
  templateUrl: './lista-usuarios.component.html',
  styleUrl: './lista-usuarios.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaUsuariosComponent {
  private readonly consultar = inject(CONSULTAR_USUARIOS_PORT);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly listado = crearListado({
    leer: filtrosUsuariosDeUrl,
    escribir: filtrosUsuariosAUrl,
    cargar: (c) => this.consultar.listar(c.filtros, c.pedido),
  });
  protected readonly enCelular = segunPantalla(CELULAR);
  protected readonly nombreEmpresa = inject(USUARIO_CABECERA).nombreEmpresa;

  protected readonly opcionesEstado = OPCIONES_ESTADO;
  /** Las opciones de «Rol»: los activos de la empresa (si no llegan, solo «Todos»). */
  protected readonly roles = signal<readonly RolAsignable[]>([]);
  protected readonly largoBusqueda = LARGO_MAXIMO_BUSQUEDA_USUARIO;
  protected readonly columnas = ['usuario', 'roles', 'ingreso', 'estado', 'abrir'] as const;
  protected readonly filtros = computed(() => this.listado.consulta().filtros);
  protected readonly usuarios = computed(() => this.listado.resultado()?.elementos ?? []);
  /** En el celular, el panel con «Rol» y «Estado» (abierto si ya hay uno elegido). */
  protected readonly verFiltros = signal(
    this.filtros().estado !== 'todos' || this.filtros().rol !== '',
  );

  protected readonly iniciales = iniciales;
  protected readonly estados = estadosDeUsuario;
  protected readonly textoRol = textoRolDeUsuario;
  protected readonly textoRoles = textoRolesDeUsuario;
  protected readonly sinIngreso = TEXTO_SIN_INGRESO;

  constructor() {
    // Un filtro de ayuda: si falla, la lista sigue (el error ya lo avisó el interceptor si tocaba).
    this.consultar.rolesAsignables().then(
      (roles) => this.roles.set(roles),
      () => undefined,
    );
  }

  protected buscar(evento: Event): void {
    this.listado.buscar({ texto: (evento.target as HTMLInputElement).value });
  }

  protected elegirRol(rol: string): void {
    this.listado.filtrar({ rol });
  }

  protected elegirEstado(estado: EstadoFiltroUsuario): void {
    this.listado.filtrar({ estado });
  }

  protected alternarFiltros(): void {
    this.verFiltros.update((ver) => !ver);
  }

  /** Toda la fila abre la ficha (el enlace del nombre ya lo hace solo). */
  protected abrir(usuario: UsuarioResumen, evento: MouseEvent): void {
    if ((evento.target as HTMLElement).closest('a') !== null) return;
    void this.router.navigate([usuario.id], { relativeTo: this.ruta });
  }
}
