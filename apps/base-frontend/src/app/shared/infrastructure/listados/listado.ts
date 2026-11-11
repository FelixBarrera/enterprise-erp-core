import { computed, DestroyRef, ErrorHandler, inject, type Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  convertToParamMap,
  type ParamMap,
  type Params,
  Router,
} from '@angular/router';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  from,
  map,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { ErrorHttp, TipoErrorHttp } from '../../domain/errors/error-http';
import { type Pagina, type PedidoPagina, ultimaPagina } from '../../domain/pagina';
import { paginaAUrl, paginaDeUrl } from './parametros-url';

/** La espera antes de buscar mientras se escribe (docs/arquitectura-frontend.md, sección 4). */
export const ESPERA_BUSQUEDA_MS = 300;

/** Qué se está pidiendo: los filtros de la lista y la página. */
export interface ConsultaListado<F> {
  readonly filtros: F;
  readonly pedido: PedidoPagina;
}

export interface OpcionesListado<F, T> {
  /** De la URL a los filtros; lo que no se entiende se ignora (`filtros-url.ts` de la lista). */
  readonly leer: (parametros: ParamMap) => F;
  /** De los filtros a la URL, **sin** los valores iniciales (`filtros-url.ts` de la lista). */
  readonly escribir: (filtros: F) => Params;
  /** Pide la página al backend (el caso de uso, por su puerto). Si falla, lanza un `ErrorHttp`. */
  readonly cargar: (consulta: ConsultaListado<F>) => Promise<Pagina<T>>;
  /**
   * Lo de la URL que no es un filtro y se conserva al filtrar, cambiar de página o limpiar (la
   * bitácora de un solo registro: `?entidad=usuario&entidadId=…`). No cuenta en `filtrosActivos`.
   */
  readonly fijos?: (parametros: ParamMap) => Params;
}

/** El estado de una lista y lo que se puede hacer con ella. Lo arma `crearListado()`. */
export interface Listado<F, T> {
  /** Lo que dice la URL ahora. */
  readonly consulta: Signal<ConsultaListado<F>>;
  /** La última página que llegó; `null` mientras carga la primera vez o si falló. */
  readonly resultado: Signal<Pagina<T> | null>;
  readonly cargando: Signal<boolean>;
  /** El error de la última consulta (ya traducido por el interceptor); `null` si salió bien. */
  readonly error: Signal<ErrorHttp | null>;
  /** Cuántos filtros tienen un valor distinto del inicial (para «2 activos» y «Limpiar filtros»). */
  readonly filtrosActivos: Signal<number>;
  /** Cambia filtros y vuelve a la página 1 (un paso más en el historial). */
  filtrar(cambios: Partial<F>): void;
  /** Como `filtrar()`, pero espera 300 ms sin cambios y no suma pasos al historial (al escribir). */
  buscar(cambios: Partial<F>): void;
  /** Otra página o tamaño (el paginador). */
  irAPagina(pedido: PedidoPagina): void;
  /** Todos los filtros a su valor inicial, página 1. */
  limpiarFiltros(): void;
  /** Vuelve a pedir lo mismo (después de un error sin conexión). */
  reintentar(): void;
}

type Respuesta<T> = { readonly pagina: Pagina<T> } | { readonly error: unknown };

/**
 * Una lista con los filtros y la página **en la URL** (`?activo=false&pagina=2`): cambiar un filtro
 * es navegar, así que volver, recargar o compartir el enlace muestra lo mismo. Si llegan
 * respuestas en desorden, solo se muestra la de la última consulta. Mientras se refresca, la
 * página anterior queda a la vista.
 *
 * Se llama en el constructor de la pantalla (necesita su `ActivatedRoute`):
 * `protected readonly listado = crearListado({ leer: filtrosDeUrl, escribir: filtrosAUrl,
 * cargar: (c) => this.buscarRoles.execute(c.filtros, c.pedido) });`
 */
export function crearListado<F, T>(opciones: OpcionesListado<F, T>): Listado<F, T> {
  const ruta = inject(ActivatedRoute);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const errores = inject(ErrorHandler);

  const leerConsulta = (parametros: ParamMap): ConsultaListado<F> => ({
    filtros: opciones.leer(parametros),
    pedido: paginaDeUrl(parametros),
  });
  const aUrl = (consulta: ConsultaListado<F>): Params => ({
    ...opciones.escribir(consulta.filtros),
    ...paginaAUrl(consulta.pedido),
  });
  /** Lo que se pide, con lo fijo de la URL: si cambia solo lo fijo, también es otra consulta. */
  const clave = (url: ParamMap): string => {
    const parametros = { ...opciones.fijos?.(url), ...aUrl(leerConsulta(url)) };
    return JSON.stringify(
      Object.keys(parametros)
        .sort()
        .map((k) => [k, parametros[k]]),
    );
  };

  const consulta = signal(leerConsulta(ruta.snapshot.queryParamMap));
  const resultado = signal<Pagina<T> | null>(null);
  const cargando = signal(true);
  const error = signal<ErrorHttp | null>(null);
  const filtrosActivos = computed(() => Object.keys(opciones.escribir(consulta().filtros)).length);

  const navegar = (siguiente: ConsultaListado<F>, reemplazar: boolean): void => {
    void router.navigate([], {
      relativeTo: ruta,
      queryParams: { ...opciones.fijos?.(ruta.snapshot.queryParamMap), ...aUrl(siguiente) },
      replaceUrl: reemplazar,
    });
  };
  // Los cambios se suman a lo último pedido, aunque la URL todavía no haya cambiado.
  let pendiente: ConsultaListado<F> | null = null;
  const conCambios = (cambios: Partial<F>): ConsultaListado<F> => ({
    filtros: { ...(pendiente ?? consulta()).filtros, ...cambios },
    pedido: { pagina: 1, tamano: (pendiente ?? consulta()).pedido.tamano },
  });

  const busquedas = new Subject<ConsultaListado<F>>();
  busquedas
    .pipe(debounceTime(ESPERA_BUSQUEDA_MS), takeUntilDestroyed(destroyRef))
    .subscribe((siguiente) => {
      // Si mientras tanto se eligió otro filtro (o se limpió), esta búsqueda ya no vale.
      if (siguiente !== pendiente) return;
      pendiente = null;
      navegar(siguiente, true);
    });

  const recargas = new Subject<void>();
  combineLatest([
    ruta.queryParamMap.pipe(
      distinctUntilChanged((a, b) => clave(a) === clave(b)),
      map(leerConsulta),
    ),
    recargas.pipe(startWith(undefined)),
  ])
    .pipe(
      tap(([actual]) => {
        consulta.set(actual);
        cargando.set(true);
        error.set(null);
      }),
      // `switchMap`: si llega otra consulta, la respuesta de la anterior se descarta.
      switchMap(([actual]) =>
        from(opciones.cargar(actual)).pipe(
          map((pagina): Respuesta<T> => ({ pagina })),
          catchError((e: unknown) => of<Respuesta<T>>({ error: e })),
        ),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe((respuesta) => {
      if ('error' in respuesta) {
        cargando.set(false);
        resultado.set(null);
        error.set(comoErrorHttp(respuesta.error, errores));
        return;
      }
      const { pagina } = respuesta;
      // Una página que quedó vacía (se borraron filas, enlace viejo): a la última que tiene datos.
      if (pagina.elementos.length === 0 && pagina.total > 0 && pagina.pagina > 1) {
        const ultima = ultimaPagina(pagina.total, pagina.tamano);
        navegar({ ...consulta(), pedido: { ...consulta().pedido, pagina: ultima } }, true);
        return;
      }
      cargando.set(false);
      resultado.set(pagina);
    });

  return {
    consulta: consulta.asReadonly(),
    resultado: resultado.asReadonly(),
    cargando: cargando.asReadonly(),
    error: error.asReadonly(),
    filtrosActivos,
    filtrar(cambios) {
      // Con lo que se estaba escribiendo: el texto ya está en el buscador.
      const siguiente = conCambios(cambios);
      pendiente = null;
      navegar(siguiente, false);
    },
    buscar(cambios) {
      pendiente = conCambios(cambios);
      busquedas.next(pendiente);
    },
    irAPagina(pedido) {
      navegar({ ...consulta(), pedido }, false);
    },
    limpiarFiltros() {
      pendiente = null;
      const filtros = opciones.leer(convertToParamMap({}));
      navegar({ filtros, pedido: { pagina: 1, tamano: consulta().pedido.tamano } }, false);
    },
    reintentar() {
      recargas.next();
    },
  };
}

/**
 * Lo que lanza el caso de uso: un `ErrorHttp` (del interceptor). Otra cosa es un defecto del
 * código: va al registro de errores y la pantalla muestra un error genérico con «Reintentar».
 */
function comoErrorHttp(e: unknown, errores: ErrorHandler): ErrorHttp {
  if (e instanceof ErrorHttp) return e;
  errores.handleError(e);
  return new ErrorHttp({
    tipo: TipoErrorHttp.ERROR_SERVIDOR,
    mensaje: 'No se pudo cargar la lista.',
    estado: 0,
    respondioLaApi: false,
    requestId: null,
    avisado: false,
  });
}
