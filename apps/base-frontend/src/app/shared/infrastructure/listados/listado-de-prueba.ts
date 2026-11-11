import { computed, signal } from '@angular/core';
import type { ErrorHttp } from '../../domain/errors/error-http';
import type { Pagina, PedidoPagina } from '../../domain/pagina';
import type { ConsultaListado, Listado } from './listado';

/**
 * Un `Listado` sin router ni backend, para probar las piezas que lo muestran (estado, paginador) y
 * las pantallas: se fija lo que se quiere ver (`resultadoFijo.set(…)`) y se miran `llamadas`.
 */
export class ListadoDePrueba<F = unknown, T = unknown> implements Listado<F, T> {
  readonly consultaFija = signal<ConsultaListado<F>>({
    filtros: {} as F,
    pedido: { pagina: 1, tamano: 20 },
  });
  readonly resultadoFijo = signal<Pagina<T> | null>(null);
  readonly cargandoFijo = signal(false);
  readonly errorFijo = signal<ErrorHttp | null>(null);
  readonly filtrosActivosFijos = signal(0);

  readonly consulta = this.consultaFija.asReadonly();
  readonly resultado = this.resultadoFijo.asReadonly();
  readonly cargando = this.cargandoFijo.asReadonly();
  readonly error = this.errorFijo.asReadonly();
  readonly filtrosActivos = computed(() => this.filtrosActivosFijos());

  /** Lo que pidió la pantalla, en orden: `['filtrar', { activo: false }]`, `['reintentar']`. */
  readonly llamadas: (readonly [string, ...unknown[]])[] = [];

  filtrar(cambios: Partial<F>): void {
    this.llamadas.push(['filtrar', cambios]);
  }
  buscar(cambios: Partial<F>): void {
    this.llamadas.push(['buscar', cambios]);
  }
  irAPagina(pedido: PedidoPagina): void {
    this.llamadas.push(['irAPagina', pedido]);
  }
  limpiarFiltros(): void {
    this.llamadas.push(['limpiarFiltros']);
  }
  reintentar(): void {
    this.llamadas.push(['reintentar']);
  }
}
