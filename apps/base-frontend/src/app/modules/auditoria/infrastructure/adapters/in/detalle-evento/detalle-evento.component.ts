import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { FechaHoraPipe } from '../../../../../../shared/infrastructure/fechas/fecha-hora.pipe';
import { EncabezadoFichaComponent } from '../../../../../../shared/infrastructure/fichas/encabezado-ficha.component';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import { mostrarMigaActual } from '../../../../../../shared/infrastructure/layout/migas/migas.service';
import {
  CELULAR,
  segunPantalla,
} from '../../../../../../shared/infrastructure/layout/pantalla-chica';
import { BarraCargaComponent } from '../../../../../../shared/infrastructure/listados/barra-carga/barra-carga.component';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { CONSULTAR_BITACORA_PORT } from '../../../../application/ports/in/consultar-bitacora.port';
import { esDeSeguridad, textoAccion } from '../../../../domain/acciones';
import { filasDeCambios, type ValorMostrado } from '../../../../domain/cambios';
import { type EventoDetalle, textoQuien, textoSobreQue } from '../../../../domain/evento';
import { fichaDelRegistro, historiaDelRegistro } from '../enlaces';
import { ValorCambioComponent } from './valor-cambio.component';

const MENSAJE_SIN_CARGAR = 'No se pudo cargar el evento.';

type Carga =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'error'; readonly mensaje: string; readonly reintentar: boolean }
  | { readonly estado: 'lista' };

/**
 * El detalle de un evento de la bitácora (`/bitacora/:id`; maqueta aprobada el 2026-11-07,
 * tableros 14 y 17): «Qué cambió», con el antes y el después de cada dato (en el celular, uno
 * debajo del otro), y «Datos del evento» (sobre qué, quién, cuándo, desde dónde), con «Ver su
 * ficha» y «Ver su historia». Los permisos de un rol, con su descripción si se puede leer el
 * catálogo («Ver roles»); si no, el código.
 */
@Component({
  selector: 'app-detalle-evento',
  imports: [
    MatButtonModule,
    RouterLink,
    BarraCargaComponent,
    EncabezadoFichaComponent,
    FechaHoraPipe,
    IconoComponent,
    ValorCambioComponent,
  ],
  templateUrl: './detalle-evento.component.html',
  styleUrl: './detalle-evento.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleEventoComponent {
  private readonly consultar = inject(CONSULTAR_BITACORA_PORT);
  private readonly permisos = inject(PERMISOS_SESION);

  protected readonly enCelular = segunPantalla(CELULAR);
  protected readonly carga = signal<Carga>({ estado: 'cargando' });
  protected readonly falla = computed(() => {
    const carga = this.carga();
    return carga.estado === 'error' ? carga : null;
  });
  protected readonly evento = signal<EventoDetalle | null>(null);
  /** Código → «Ver usuarios»; `null` mientras no llega (o sin permiso para leerlo). */
  private readonly descripciones = signal<ReadonlyMap<string, string> | null>(null);

  protected readonly titulo = computed(() => {
    const evento = this.evento();
    return evento === null ? '' : textoAccion(evento.accion);
  });
  protected readonly filas = computed(() => {
    const evento = this.evento();
    if (evento === null) return [];
    const descripciones = this.descripciones();
    return filasDeCambios(evento.antes, evento.despues, {
      textoPermiso:
        descripciones === null ? undefined : (codigo) => descripciones.get(codigo) ?? codigo,
    });
  });
  /** «Solo los datos que cambiaron» cuando hay los dos lados (al crear, solo cómo quedó). */
  protected readonly conAntesYDespues = computed(() => {
    const evento = this.evento();
    return evento !== null && evento.antes !== null && evento.despues !== null;
  });
  /** La leyenda de colores, solo si alguna lista tiene algo agregado o quitado. */
  protected readonly hayMarcas = computed(() =>
    this.filas().some((f) => tieneMarcas(f.antes) || tieneMarcas(f.despues)),
  );
  protected readonly ficha = computed(() => {
    const evento = this.evento();
    return evento === null
      ? null
      : fichaDelRegistro(evento.entidad, evento.entidadId, (p) => this.permisos.tiene(p));
  });
  protected readonly historia = computed(() => {
    const evento = this.evento();
    return evento === null ? null : historiaDelRegistro(evento.entidad, evento.entidadId);
  });

  protected readonly esDeSeguridad = esDeSeguridad;
  protected readonly textoQuien = textoQuien;
  protected readonly textoSobreQue = textoSobreQue;

  private id = '';

  constructor() {
    mostrarMigaActual(() => (this.evento() === null ? null : this.titulo()));
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
      const evento = await this.consultar.ver(this.id);
      this.evento.set(evento);
      this.carga.set({ estado: 'lista' });
      this.cargarDescripciones(evento);
    } catch (error) {
      this.carga.set({ estado: 'error', ...falloAlCargar(error) });
    }
  }

  /** Solo si el evento trae permisos y se puede leer el catálogo; si falla, quedan los códigos. */
  private cargarDescripciones(evento: EventoDetalle): void {
    const conPermisos = evento.antes?.['permisos'] ?? evento.despues?.['permisos'];
    if (conPermisos === undefined || this.descripciones() !== null) return;
    if (!this.permisos.tiene('auth.rol.ver')) return;
    this.consultar.descripcionesPermisos().then(
      (descripciones) => this.descripciones.set(descripciones),
      () => undefined,
    );
  }
}

function tieneMarcas(valor: ValorMostrado): boolean {
  return valor.tipo === 'lista' && valor.elementos.some((e) => e.cambio !== null);
}

function falloAlCargar(error: unknown): { mensaje: string; reintentar: boolean } {
  if (
    error instanceof ErrorHttp &&
    (error.tipo === TipoErrorHttp.NO_ENCONTRADO || error.tipo === TipoErrorHttp.VALIDACION)
  ) {
    return { mensaje: error.message, reintentar: false };
  }
  return { mensaje: MENSAJE_SIN_CARGAR, reintentar: true };
}
