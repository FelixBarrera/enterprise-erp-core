import { ChangeDetectionStrategy, Component, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type ParamMap, type Params, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ErrorHttp, TipoErrorHttp } from '../../domain/errors/error-http';
import type { Pagina } from '../../domain/pagina';
import { type ConsultaListado, crearListado, ESPERA_BUSQUEDA_MS } from './listado';
import { booleanoDeUrl, filtroAUrl, textoDeUrl } from './parametros-url';

interface Filtros {
  readonly buscar: string;
  readonly activo: boolean;
}

const leer = (p: ParamMap): Filtros => ({
  buscar: textoDeUrl(p, 'buscar'),
  activo: booleanoDeUrl(p, 'activo', true),
});
const escribir = (f: Filtros) => ({
  ...filtroAUrl('buscar', f.buscar, ''),
  ...filtroAUrl('activo', f.activo, true),
});

/** Cada consulta queda esperando hasta que la prueba la responde. */
class BackendDePrueba {
  readonly pedidos: {
    consulta: ConsultaListado<Filtros>;
    responder: (p: Pagina<string>) => void;
    fallar: (e: unknown) => void;
  }[] = [];

  cargar = (consulta: ConsultaListado<Filtros>): Promise<Pagina<string>> =>
    new Promise((responder, fallar) => this.pedidos.push({ consulta, responder, fallar }));

  ultimo() {
    const pedido = this.pedidos.at(-1);
    if (pedido === undefined) throw new Error('No hubo pedidos');
    return pedido;
  }
}

let backend: BackendDePrueba;
let fijos: ((p: ParamMap) => Params) | undefined;

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Lista {
  readonly listado = crearListado<Filtros, string>({
    leer,
    escribir,
    cargar: backend.cargar,
    fijos,
  });
}

function pagina(elementos: string[], extra: Partial<Pagina<string>> = {}): Pagina<string> {
  return { elementos, total: elementos.length, pagina: 1, tamano: 20, ...extra };
}

const errorHttp = (tipo: TipoErrorHttp, avisado: boolean) =>
  new ErrorHttp({
    tipo,
    mensaje: 'Algo pasó',
    estado: 400,
    respondioLaApi: true,
    requestId: null,
    avisado,
  });

async function montar(url = '/lista', conFijos?: (p: ParamMap) => Params) {
  backend = new BackendDePrueba();
  fijos = conFijos;
  const errores = { handleError: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'lista', component: Lista }]),
      { provide: ErrorHandler, useValue: errores },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const lista = await harness.navigateByUrl(url, Lista);
  const router = TestBed.inject(Router);
  // La respuesta y la navegación terminan en tareas siguientes: se deja correr una vuelta.
  const esperar = async () => {
    await harness.fixture.whenStable();
    await new Promise((listo) => setTimeout(listo));
    await harness.fixture.whenStable();
  };
  return { listado: lista.listado, router, esperar, errores };
}

describe('crearListado', () => {
  it('lee los filtros y la página de la URL, e ignora lo que no entiende', async () => {
    const { listado } = await montar('/lista?buscar=caja&activo=false&pagina=2&tamano=7');
    expect(backend.ultimo().consulta).toEqual({
      filtros: { buscar: 'caja', activo: false },
      pedido: { pagina: 2, tamano: 20 },
    });
    expect(listado.filtrosActivos()).toBe(2);
    expect(listado.cargando()).toBe(true);
    expect(listado.resultado()).toBeNull();
  });

  it('muestra la página que llega', async () => {
    const { listado, esperar } = await montar();
    backend.ultimo().responder(pagina(['a', 'b']));
    await esperar();
    expect(listado.cargando()).toBe(false);
    expect(listado.resultado()?.elementos).toEqual(['a', 'b']);
  });

  it('filtrar navega a la página 1, sin escribir los valores iniciales', async () => {
    const { listado, router, esperar } = await montar('/lista?pagina=3&tamano=50');
    listado.filtrar({ activo: false });
    await esperar();
    expect(router.url).toBe('/lista?activo=false&tamano=50');
    listado.filtrar({ activo: true });
    await esperar();
    expect(router.url).toBe('/lista?tamano=50');
  });

  it('mientras refresca, la página anterior sigue a la vista', async () => {
    const { listado, esperar } = await montar();
    backend.ultimo().responder(pagina(['a']));
    await esperar();
    listado.filtrar({ activo: false });
    await esperar();
    expect(listado.cargando()).toBe(true);
    expect(listado.resultado()?.elementos).toEqual(['a']);
  });

  it('con respuestas en desorden, solo se muestra la de la última consulta', async () => {
    const { listado, esperar } = await montar();
    const primera = backend.ultimo();
    listado.filtrar({ activo: false });
    await esperar();
    const segunda = backend.ultimo();
    segunda.responder(pagina(['nueva']));
    await esperar();
    primera.responder(pagina(['vieja']));
    await esperar();
    expect(listado.resultado()?.elementos).toEqual(['nueva']);
  });

  it('buscar espera 300 ms sin cambios y no suma pasos al historial', async () => {
    vi.useFakeTimers();
    try {
      const { listado, router, esperar } = await montar();
      const navegar = vi.spyOn(router, 'navigate');
      listado.buscar({ buscar: 'ca' });
      vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS - 1);
      listado.buscar({ buscar: 'caja' });
      vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS - 1);
      expect(navegar).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(navegar).toHaveBeenCalledTimes(1);
      expect(navegar.mock.calls[0]?.[1]).toMatchObject({
        queryParams: { buscar: 'caja' },
        replaceUrl: true,
      });
      vi.useRealTimers();
      await esperar();
      expect(router.url).toBe('/lista?buscar=caja');
    } finally {
      vi.useRealTimers();
    }
  });

  it('un filtro elegido mientras espera la búsqueda la incluye, y la búsqueda vieja no lo pisa', async () => {
    vi.useFakeTimers();
    try {
      const { listado, router } = await montar();
      const navegar = vi.spyOn(router, 'navigate');
      listado.buscar({ buscar: 'caja' });
      listado.filtrar({ activo: false });
      vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS);
      expect(navegar).toHaveBeenCalledTimes(1);
      expect(navegar.mock.calls[0]?.[1]).toMatchObject({
        queryParams: { buscar: 'caja', activo: 'false' },
        replaceUrl: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('cambiar de página conserva los filtros', async () => {
    const { listado, router, esperar } = await montar('/lista?buscar=caja');
    listado.irAPagina({ pagina: 2, tamano: 50 });
    await esperar();
    expect(router.url).toBe('/lista?buscar=caja&pagina=2&tamano=50');
  });

  it('limpiar los filtros conserva el tamaño de página', async () => {
    const { listado, router, esperar } = await montar(
      '/lista?buscar=caja&activo=false&tamano=50&pagina=4',
    );
    listado.limpiarFiltros();
    await esperar();
    expect(router.url).toBe('/lista?tamano=50');
    expect(listado.filtrosActivos()).toBe(0);
  });

  it('lo fijo de la URL se conserva al filtrar, cambiar de página y limpiar, y no cuenta', async () => {
    const registro = (p: ParamMap): Params => {
      const id = p.get('registro');
      return id === null ? {} : { registro: id };
    };
    const { listado, router, esperar } = await montar('/lista?registro=r1&buscar=caja', registro);
    expect(listado.filtrosActivos()).toBe(1);
    listado.filtrar({ activo: false });
    await esperar();
    expect(router.url).toBe('/lista?registro=r1&buscar=caja&activo=false');
    listado.irAPagina({ pagina: 2, tamano: 20 });
    await esperar();
    expect(router.url).toBe('/lista?registro=r1&buscar=caja&activo=false&pagina=2');
    listado.limpiarFiltros();
    await esperar();
    expect(router.url).toBe('/lista?registro=r1');
    // Quitar solo lo fijo (los filtros quedan iguales) es otra consulta.
    const pedidos = backend.pedidos.length;
    await router.navigateByUrl('/lista');
    await esperar();
    expect(backend.pedidos).toHaveLength(pedidos + 1);
  });

  it('una página que quedó vacía lleva a la última con datos', async () => {
    const { router, esperar } = await montar('/lista?pagina=9');
    backend.ultimo().responder(pagina([], { total: 41, pagina: 9 }));
    await esperar();
    expect(router.url).toBe('/lista?pagina=3');
    expect(backend.ultimo().consulta.pedido.pagina).toBe(3);
  });

  it('si falla, muestra el error y reintentar pide lo mismo otra vez', async () => {
    const { listado, esperar } = await montar('/lista?buscar=caja');
    const error = errorHttp(TipoErrorHttp.SIN_CONEXION, true);
    backend.ultimo().fallar(error);
    await esperar();
    expect(listado.error()).toBe(error);
    expect(listado.cargando()).toBe(false);
    expect(listado.resultado()).toBeNull();

    listado.reintentar();
    expect(backend.pedidos).toHaveLength(2);
    expect(backend.ultimo().consulta.filtros.buscar).toBe('caja');
    expect(listado.error()).toBeNull();
    expect(listado.cargando()).toBe(true);
  });

  it('un error que no es de la API va al registro y se muestra uno genérico', async () => {
    const { listado, esperar, errores } = await montar();
    const defecto = new TypeError('x is undefined');
    backend.ultimo().fallar(defecto);
    await esperar();
    expect(errores.handleError).toHaveBeenCalledWith(defecto);
    expect(listado.error()?.message).toBe('No se pudo cargar la lista.');
    expect(listado.error()?.avisado).toBe(false);
  });

  it('navegar a la misma consulta no vuelve a pedirla', async () => {
    const { listado, esperar } = await montar('/lista?buscar=caja');
    listado.filtrar({ buscar: ' caja ' });
    await esperar();
    expect(backend.pedidos).toHaveLength(1);
  });
});
