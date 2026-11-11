import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EncabezadoFichaComponent } from './encabezado-ficha.component';

@Component({
  imports: [EncabezadoFichaComponent],
  template: `
    <app-encabezado-ficha titulo="Jefe de oficina" volverA="/roles" textoVolver="Roles">
      <span fichaEstado class="estado estado--exito">Activo</span>
      <span fichaDetalle>2 usuarios</span>
      <button fichaAcciones type="button">Desactivar</button>
    </app-encabezado-ficha>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Ficha {}

@Component({ template: '<h1>Lista</h1>', changeDetection: ChangeDetectionStrategy.OnPush })
class Lista {}

async function montar(desde: string | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'roles', component: Lista },
        { path: 'roles/:id', component: Ficha },
        { path: 'otra', component: Lista },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  if (desde !== null) await harness.navigateByUrl(desde);
  await harness.navigateByUrl('/roles/1');
  const html = harness.routeNativeElement as HTMLElement;
  const atras = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
  const router = TestBed.inject(Router);
  const volver = async () => {
    html.querySelector<HTMLButtonElement>('button[aria-label="Volver a Roles"]')?.click();
    await harness.fixture.whenStable();
  };
  return { html, atras, router, volver };
}

describe('EncabezadoFichaComponent', () => {
  it('muestra el nombre, el estado, el detalle y las acciones', async () => {
    const { html } = await montar(null);
    expect(html.querySelector('h1')?.textContent).toBe('Jefe de oficina');
    expect(html.querySelector('.estado')?.textContent).toBe('Activo');
    expect(html.textContent).toContain('2 usuarios');
    expect(html.querySelector('.encabezado-ficha__acciones button')?.textContent).toBe(
      'Desactivar',
    );
  });

  it('si se llegó desde la lista, vuelve a ella como estaba (con sus filtros)', async () => {
    const { atras, volver } = await montar('/roles?activo=false&pagina=2');
    await volver();
    expect(atras).toHaveBeenCalledTimes(1);
  });

  it('si se abrió directo o desde otra pantalla, va a la lista', async () => {
    const { atras, router, volver } = await montar('/otra');
    await volver();
    expect(atras).not.toHaveBeenCalled();
    expect(router.url).toBe('/roles');
  });

  it('abierta por el enlace, sin pantalla anterior, va a la lista', async () => {
    const { atras, router, volver } = await montar(null);
    await volver();
    expect(atras).not.toHaveBeenCalled();
    expect(router.url).toBe('/roles');
  });
});
