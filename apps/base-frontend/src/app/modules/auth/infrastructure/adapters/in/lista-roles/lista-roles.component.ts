import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CELULAR,
  segunPantalla,
} from '../../../../../../shared/infrastructure/layout/pantalla-chica';
import { cerrarFrase } from '../../../../../../shared/domain/frases';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import { USUARIO_CABECERA } from '../../../../../../shared/infrastructure/layout/usuario-cabecera';
import { BarraCargaComponent } from '../../../../../../shared/infrastructure/listados/barra-carga/barra-carga.component';
import { EstadoListaComponent } from '../../../../../../shared/infrastructure/listados/estado-lista/estado-lista.component';
import { crearListado } from '../../../../../../shared/infrastructure/listados/listado';
import { PaginadorComponent } from '../../../../../../shared/infrastructure/listados/paginador/paginador.component';
import { ConPermisoDirective } from '../../../../../../shared/infrastructure/permisos/con-permiso.directive';
import { CONSULTAR_ROLES_PORT } from '../../../../application/ports/in/consultar-roles.port';
import {
  cifrasDelRol,
  type EstadoRol,
  LARGO_MAXIMO_BUSQUEDA_ROL,
  type RolResumen,
  textoPermisosDelRol,
} from '../../../../domain/rol';
import { filtrosRolesAUrl, filtrosRolesDeUrl } from './filtros-url';

/** Las opciones de «Estado», en el orden en que se ven. */
const OPCIONES_ESTADO: readonly { readonly valor: EstadoRol; readonly texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'activos', texto: 'Activos' },
  { valor: 'desactivados', texto: 'Desactivados' },
];

/**
 * La lista de roles de la empresa activa (`/roles`, con `auth.rol.ver`): buscar por nombre y
 * filtrar por estado, con todo en la URL. Toda la fila abre la ficha. En el celular, tarjetas y
 * el filtro de estado detrás del botón «Filtros». «Nuevo rol», con `auth.rol.crear`.
 */
@Component({
  selector: 'app-lista-roles',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
    IconoComponent,
    BarraCargaComponent,
    EstadoListaComponent,
    PaginadorComponent,
    ConPermisoDirective,
  ],
  templateUrl: './lista-roles.component.html',
  styleUrl: './lista-roles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaRolesComponent {
  private readonly consultar = inject(CONSULTAR_ROLES_PORT);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly listado = crearListado({
    leer: filtrosRolesDeUrl,
    escribir: filtrosRolesAUrl,
    cargar: (c) => this.consultar.listar(c.filtros, c.pedido),
  });
  protected readonly enCelular = segunPantalla(CELULAR);
  protected readonly nombreEmpresa = inject(USUARIO_CABECERA).nombreEmpresa;
  protected readonly subtitulo = computed(() => {
    const empresa = this.nombreEmpresa();
    return cerrarFrase(`Qué puede hacer cada grupo de personas${empresa ? ` en ${empresa}` : ''}`);
  });

  protected readonly opcionesEstado = OPCIONES_ESTADO;
  protected readonly largoBusqueda = LARGO_MAXIMO_BUSQUEDA_ROL;
  protected readonly columnas = ['rol', 'permisos', 'usuarios', 'estado', 'abrir'] as const;
  protected readonly filtros = computed(() => this.listado.consulta().filtros);
  protected readonly roles = computed(() => this.listado.resultado()?.elementos ?? []);
  /** En el celular, el panel con «Estado» (abierto si ya hay un estado elegido). */
  protected readonly verFiltros = signal(this.filtros().estado !== 'todos');
  protected readonly textoPermisos = textoPermisosDelRol;
  protected readonly cifras = cifrasDelRol;

  protected buscar(evento: Event): void {
    this.listado.buscar({ texto: (evento.target as HTMLInputElement).value });
  }

  protected elegirEstado(estado: EstadoRol): void {
    this.listado.filtrar({ estado });
  }

  protected alternarFiltros(): void {
    this.verFiltros.update((ver) => !ver);
  }

  /** Toda la fila abre la ficha (el enlace del nombre ya lo hace solo). */
  protected abrir(rol: RolResumen, evento: MouseEvent): void {
    if ((evento.target as HTMLElement).closest('a') !== null) return;
    void this.router.navigate([rol.id], { relativeTo: this.ruta });
  }
}
