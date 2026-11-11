import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MENU_APLICACION, type SeccionMenu } from '../menu';
import { MigasService, mostrarMigaActual } from './migas.service';

const MENU: readonly SeccionMenu[] = [
  {
    id: 'administracion',
    titulo: 'Administración',
    opciones: [{ texto: 'Roles', ruta: '/roles', icono: 'escudo' }],
  },
];

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Lista {}

const nombre = signal<string | null>(null);

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Ficha {
  constructor() {
    mostrarMigaActual(() => nombre());
  }
}

async function montar() {
  TestBed.configureTestingModule({
    providers: [
      { provide: MENU_APLICACION, useValue: MENU },
      provideRouter([
        { path: '', component: Lista },
        {
          path: 'roles',
          data: { miga: 'Roles' },
          children: [
            { path: '', component: Lista },
            { path: 'nuevo', component: Lista, data: { miga: 'Nuevo rol' } },
            { path: ':id', component: Ficha },
          ],
        },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  const servicio = TestBed.inject(MigasService);
  const ir = async (url: string) => {
    await harness.navigateByUrl(url);
  };
  return { servicio, ir };
}

describe('MigasService', () => {
  beforeEach(() => nombre.set(null));

  it('arma las migas con cada navegación (sin repetir la miga heredada)', async () => {
    const { servicio, ir } = await montar();
    await ir('/roles?activo=false');
    expect(servicio.migas().map((m) => m.texto)).toEqual(['Administración', 'Roles']);
    await ir('/roles/nuevo');
    expect(servicio.migas()).toEqual([
      { texto: 'Administración', url: null },
      { texto: 'Roles', url: '/roles' },
      { texto: 'Nuevo rol', url: null },
    ]);
    await ir('/');
    expect(servicio.migas()).toEqual([]);
  });

  it('la ficha suma el nombre del registro cuando llega, y lo quita al salir', async () => {
    const { servicio, ir } = await montar();
    await ir('/roles/0193');
    expect(servicio.migas().map((m) => m.texto)).toEqual(['Administración', 'Roles']);
    nombre.set('Jefe de oficina');
    expect(servicio.migas().map((m) => m.texto)).toEqual([
      'Administración',
      'Roles',
      'Jefe de oficina',
    ]);
    expect(servicio.migas()[1]?.url).toBe('/roles');
    await ir('/roles');
    expect(servicio.migas().map((m) => m.texto)).toEqual(['Administración', 'Roles']);
  });
});
