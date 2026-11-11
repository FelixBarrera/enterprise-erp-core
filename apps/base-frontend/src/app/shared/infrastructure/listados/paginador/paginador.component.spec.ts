import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { of } from 'rxjs';
import { PaginadorEnEspanol } from '../../material/paginador-en-espanol';
import { ListadoDePrueba } from '../listado-de-prueba';
import { PaginadorComponent } from './paginador.component';

function montar(enCelular = false) {
  TestBed.configureTestingModule({
    providers: [
      { provide: MatPaginatorIntl, useClass: PaginadorEnEspanol },
      {
        provide: BreakpointObserver,
        useValue: {
          observe: () => of({ matches: enCelular, breakpoints: {} }),
          isMatched: () => enCelular,
        },
      },
    ],
  });
  const listado = new ListadoDePrueba();
  const fixture = TestBed.createComponent(PaginadorComponent);
  fixture.componentRef.setInput('listado', listado);
  const html = fixture.nativeElement as HTMLElement;
  const ver = async () => {
    await fixture.whenStable();
    return (html.textContent ?? '').replace(/\s+/gu, ' ').trim();
  };
  return { listado, html, ver };
}

describe('PaginadorComponent', () => {
  it('no se ve sin página o con la lista vacía', async () => {
    const { listado, html, ver } = montar();
    await ver();
    expect(html.querySelector('mat-paginator')).toBeNull();
    listado.resultadoFijo.set({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    await ver();
    expect(html.querySelector('mat-paginator')).toBeNull();
  });

  it('en español, con la página del listado, y pide otra al tocar «Página siguiente»', async () => {
    const { listado, html, ver } = montar();
    listado.resultadoFijo.set({ elementos: ['a'], total: 57, pagina: 2, tamano: 20 });
    const texto = await ver();
    expect(texto).toContain('Filas por página');
    expect(texto).toContain('21 – 40 de 57');
    html.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')?.click();
    expect(listado.llamadas).toEqual([['irAPagina', { pagina: 3, tamano: 20 }]]);
  });

  it('en el celular, sin «Filas por página»', async () => {
    const { listado, ver } = montar(true);
    listado.resultadoFijo.set({ elementos: ['a'], total: 57, pagina: 1, tamano: 20 });
    const texto = await ver();
    expect(texto).not.toContain('Filas por página');
    expect(texto).toContain('1 – 20 de 57');
  });
});
