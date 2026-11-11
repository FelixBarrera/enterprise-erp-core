import { TestBed } from '@angular/core/testing';
import { ErrorHttp, TipoErrorHttp } from '../../../domain/errors/error-http';
import { ListadoDePrueba } from '../listado-de-prueba';
import { EstadoListaComponent } from './estado-lista.component';

function error(tipo: TipoErrorHttp, avisado: boolean, mensaje = 'La fecha no es válida') {
  return new ErrorHttp({
    tipo,
    mensaje,
    estado: 400,
    respondioLaApi: true,
    requestId: null,
    avisado,
  });
}

function montar() {
  const listado = new ListadoDePrueba();
  const fixture = TestBed.createComponent(EstadoListaComponent);
  fixture.componentRef.setInput('listado', listado);
  fixture.componentRef.setInput('vacio', 'No hay roles');
  fixture.componentRef.setInput('vacioConFiltros', 'Ningún rol coincide con los filtros');
  const html = fixture.nativeElement as HTMLElement;
  const ver = async () => {
    await fixture.whenStable();
    return (html.textContent ?? '').replace(/\s+/gu, ' ').trim();
  };
  const boton = () => html.querySelector('button');
  return { listado, html, ver, boton };
}

describe('EstadoListaComponent', () => {
  it('mientras carga la primera vez, nada (ni «No hay datos»)', async () => {
    const { listado, ver } = montar();
    listado.cargandoFijo.set(true);
    expect(await ver()).toBe('');
  });

  it('con filas, nada', async () => {
    const { listado, ver } = montar();
    listado.resultadoFijo.set({ elementos: ['a'], total: 1, pagina: 1, tamano: 20 });
    expect(await ver()).toBe('');
  });

  it('vacía sin filtros: el texto de la lista', async () => {
    const { listado, ver, boton } = montar();
    listado.resultadoFijo.set({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    expect(await ver()).toBe('No hay roles');
    expect(boton()).toBeNull();
  });

  it('vacía con filtros: «Limpiar filtros»', async () => {
    const { listado, ver, boton } = montar();
    listado.resultadoFijo.set({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    listado.filtrosActivosFijos.set(2);
    expect(await ver()).toContain('Ningún rol coincide con los filtros');
    boton()?.click();
    expect(listado.llamadas).toEqual([['limpiarFiltros']]);
  });

  it('un 400: el mensaje del backend, sin «Reintentar»', async () => {
    const { listado, html, ver, boton } = montar();
    listado.errorFijo.set(error(TipoErrorHttp.VALIDACION, false));
    expect(await ver()).toBe('La fecha no es válida');
    expect(html.querySelector('[role="alert"]')).not.toBeNull();
    expect(boton()).toBeNull();
  });

  it('sin conexión (ya avisado): un texto corto y «Reintentar»', async () => {
    const { listado, ver, boton } = montar();
    listado.errorFijo.set(error(TipoErrorHttp.SIN_CONEXION, true, 'No hay conexión'));
    expect(await ver()).toContain('No se pudo cargar la lista.');
    expect(await ver()).not.toContain('No hay conexión');
    boton()?.click();
    expect(listado.llamadas).toEqual([['reintentar']]);
  });
});
