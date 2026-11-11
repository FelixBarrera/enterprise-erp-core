import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { diaEnZona, esDia, lugarDeZona } from '../../../../../../shared/domain/fechas';
import { FechaHoraPipe } from '../../../../../../shared/infrastructure/fechas/fecha-hora.pipe';
import { RELOJ } from '../../../../../../shared/infrastructure/fechas/reloj';
import { ZONA_NEGOCIO } from '../../../../../../shared/infrastructure/fechas/zona-negocio';
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
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { CONSULTAR_BITACORA_PORT } from '../../../../application/ports/in/consultar-bitacora.port';
import { esDeSeguridad, GRUPOS_ACCIONES, textoAccion } from '../../../../domain/acciones';
import {
  type EventoResumen,
  textoQuien,
  textoSobreQue,
  type UsuarioDeBitacora,
} from '../../../../domain/evento';
import { RANGO_MAXIMO_DIAS, textoRango } from '../../../../domain/filtros-bitacora';
import { textoHistoria } from '../../../../domain/registro';
import { fichaDelRegistro } from '../enlaces';
import { filtrosBitacoraUrl } from './filtros-url';

/**
 * La bitácora de la empresa activa (`/bitacora`, con `auditoria.evento.ver`; maqueta aprobada el
 * 2026-11-07, tableros 13 y 16): qué se hizo, quién y cuándo, del más nuevo al más viejo. Abre con
 * los últimos 7 días; filtros por fechas, usuario y «Qué hizo» (una acción o un grupo), todo en la
 * URL. En el celular, tarjetas y los filtros detrás del botón «Filtros». Toda la fila abre el
 * detalle (`/bitacora/:id`, 6.12c2).
 *
 * Con `?entidad=usuario&entidadId=…` («Ver historia» de una ficha, tablero 15): solo lo que se hizo
 * con ese registro, sin límite de fechas, con un aviso arriba para volver a su ficha o ver toda la
 * bitácora. El registro no es un filtro: «Limpiar filtros» lo conserva.
 */
@Component({
  selector: 'app-bitacora',
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
  ],
  templateUrl: './bitacora.component.html',
  styleUrl: './bitacora.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitacoraComponent {
  private readonly consultar = inject(CONSULTAR_BITACORA_PORT);
  private readonly zona = inject(ZONA_NEGOCIO);
  /** Hoy en la zona del negocio, al abrir la pantalla (nunca la del navegador: regla 11). */
  private readonly hoy = diaEnZona(inject(RELOJ).ahora(), this.zona());
  private readonly url = filtrosBitacoraUrl(this.hoy);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly permisos = inject(PERMISOS_SESION);

  protected readonly listado = crearListado({
    leer: this.url.leer,
    escribir: this.url.escribir,
    fijos: this.url.fijos,
    cargar: (c) => this.consultar.listar(c.filtros, c.pedido),
  });
  protected readonly enCelular = segunPantalla(CELULAR);
  protected readonly nombreEmpresa = inject(USUARIO_CABECERA).nombreEmpresa;

  protected readonly grupos = GRUPOS_ACCIONES;
  /** Las opciones de «Usuario» (si no llegan, solo «Todos»). */
  protected readonly usuarios = signal<readonly UsuarioDeBitacora[]>([]);
  protected readonly columnas = ['fecha', 'quien', 'accion', 'sobre', 'abrir'] as const;
  protected readonly filtros = computed(() => this.listado.consulta().filtros);
  /** La historia de un registro; `null`, toda la bitácora. */
  protected readonly registro = computed(() => this.filtros().registro);
  /**
   * El aviso de la historia: «Historia del usuario jorge.vera». El nombre, el del evento más nuevo
   * de la página (cómo se llamaba entonces); sin eventos, «de un usuario».
   */
  protected readonly historia = computed(() => {
    const registro = this.registro();
    if (registro === null) return null;
    const nombre =
      this.eventos().find((e) => e.entidadId === registro.entidadId)?.entidadNombre ?? null;
    return {
      ...textoHistoria(registro.entidad, nombre),
      ficha: fichaDelRegistro(registro.entidad, registro.entidadId, (p) => this.permisos.tiene(p)),
    };
  });
  protected readonly eventos = computed(() => this.listado.resultado()?.elementos ?? []);
  protected readonly rango = computed(() => textoRango(this.filtros().desde, this.filtros().hasta));
  protected readonly ayuda = computed(() => {
    const lugar = lugarDeZona(this.zona());
    return this.registro() === null
      ? `Hasta ${RANGO_MAXIMO_DIAS} días por búsqueda. Fechas y horas de ${lugar}.`
      : `Toda su historia, sin límite de días. Fechas y horas de ${lugar}.`;
  });
  /** En el celular, el panel de filtros (abierto si ya hay uno elegido). */
  protected readonly verFiltros = signal(this.listado.filtrosActivos() > 0);

  protected readonly textoAccion = textoAccion;
  protected readonly esDeSeguridad = esDeSeguridad;
  protected readonly textoQuien = textoQuien;
  protected readonly textoSobreQue = textoSobreQue;

  constructor() {
    // Un filtro de ayuda: si falla, la lista sigue (el error ya lo avisó el interceptor si tocaba).
    this.consultar.usuarios().then(
      (usuarios) => this.usuarios.set(usuarios),
      () => undefined,
    );
  }

  /**
   * «Desde» o «Hasta». Un campo vaciado (o un día a medio escribir) no cambia la búsqueda: el campo
   * vuelve a mostrar la fecha que se está usando. En la historia de un registro, vaciarlo quita
   * ese límite.
   */
  protected elegirFecha(campo: 'desde' | 'hasta', evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const sinLimite = entrada.value === '' && this.registro() !== null;
    if (!esDia(entrada.value) && !sinLimite) {
      entrada.value = this.filtros()[campo];
      return;
    }
    if (entrada.value === this.filtros()[campo]) return;
    this.listado.filtrar(campo === 'desde' ? { desde: entrada.value } : { hasta: entrada.value });
  }

  protected elegirUsuario(usuario: string): void {
    this.listado.filtrar({ usuario });
  }

  protected elegirAccion(accion: string): void {
    this.listado.filtrar({ accion });
  }

  protected alternarFiltros(): void {
    this.verFiltros.update((ver) => !ver);
  }

  protected identificar(_indice: number, evento: EventoResumen): string {
    return evento.id;
  }

  /** Toda la fila abre el detalle (el enlace de «Qué hizo» ya lo hace solo). */
  protected abrir(evento: EventoResumen, clic: MouseEvent): void {
    if ((clic.target as HTMLElement).closest('a') !== null) return;
    void this.router.navigate([evento.id], { relativeTo: this.ruta });
  }
}
