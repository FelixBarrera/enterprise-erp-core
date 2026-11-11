import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { MENU_APLICACION } from '../menu';
import { armarMigas, type Miga, type NivelConMiga } from './migas';

function nivelesConMiga(raiz: ActivatedRouteSnapshot): NivelConMiga[] {
  const niveles: NivelConMiga[] = [];
  const camino: string[] = [];
  let ruta: ActivatedRouteSnapshot | null = raiz;
  while (ruta !== null) {
    camino.push(...ruta.url.map((segmento) => segmento.path));
    // Solo la del propio nivel (no la heredada de un padre con `path: ''`).
    const texto: unknown = ruta.routeConfig?.data?.['miga'];
    if (typeof texto === 'string') niveles.push({ texto, url: `/${camino.join('/')}` });
    ruta = ruta.firstChild;
  }
  return niveles;
}

/**
 * Las migas de pan de la cabecera. Se arman solas con cada navegación; la ficha suma el nombre del
 * registro con `mostrarMigaActual()`.
 */
@Injectable({ providedIn: 'root' })
export class MigasService {
  private readonly router = inject(Router);
  private readonly menu = inject(MENU_APLICACION);

  private readonly navegacion = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.leer()),
    ),
    { initialValue: this.leer() },
  );
  private readonly actual = signal<(() => string | null) | null>(null);

  readonly migas = computed<readonly Miga[]>(() => {
    const { url, niveles } = this.navegacion();
    return armarMigas(this.menu, url, niveles, this.actual()?.() ?? null);
  });

  /** Lo usa `mostrarMigaActual()`. Devuelve cómo quitarla. */
  fijarActual(texto: () => string | null): () => void {
    this.actual.set(texto);
    return () => {
      if (this.actual() === texto) this.actual.set(null);
    };
  }

  private leer(): { url: string; niveles: NivelConMiga[] } {
    return { url: this.router.url, niveles: nivelesConMiga(this.router.routerState.snapshot.root) };
  }
}

/**
 * En una ficha: el nombre del registro como última miga, mientras la pantalla está abierta. Se
 * llama al declarar un campo o en el constructor:
 * `constructor() { mostrarMigaActual(() => this.rol()?.nombre ?? null); }`
 */
export function mostrarMigaActual(texto: () => string | null): void {
  const quitar = inject(MigasService).fijarActual(texto);
  inject(DestroyRef).onDestroy(quitar);
}
