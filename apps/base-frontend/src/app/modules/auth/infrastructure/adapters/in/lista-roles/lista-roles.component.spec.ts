import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Pagina, PedidoPagina } from '../../../../../../shared/domain/pagina';
import { USUARIO_CABECERA } from '../../../../../../shared/infrastructure/layout/usuario-cabecera';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { PermisosDePrueba } from '../../../../../../shared/infrastructure/permisos/permisos-de-prueba';
import { CONSULTAR_ROLES_PORT } from '../../../../application/ports/in/consultar-roles.port';
import { rolResumenDePrueba } from '../../../../application/testing/roles-de-prueba';
import type { FiltrosRoles, RolResumen } from '../../../../domain/rol';
import { ListaRolesComponent } from './lista-roles.component';

const ROLES: RolResumen[] = [
  rolResumenDePrueba({
    id: 'r-0',
    nombre: 'Administrador',
    descripcion: 'Tiene todos los permisos',
    esAdministrador: true,
    cantidadPermisos: 12,
  }),
  rolResumenDePrueba(),
  rolResumenDePrueba({ id: 'r-2', nombre: 'Soporte', descripcion: null, activo: false }),
];

function pagina(elementos: RolResumen[]): Pagina<RolResumen> {
  return { elementos, total: elementos.length, pagina: 1, tamano: 20 };
}

async function montar(url = '/roles', permisos = ['auth.rol.ver', 'auth.rol.crear']) {
  const listar = vi.fn((_f: FiltrosRoles, _p: PedidoPagina) => Promise.resolve(pagina(ROLES)));
  TestBed.configureTestingModule({
    providers: [
      ...PROVIDERS_MATERIAL,
      provideRouter([
        { path: 'roles', component: ListaRolesComponent },
        { path: 'roles/:id', children: [] },
      ]),
      { provide: CONSULTAR_ROLES_PORT, useValue: { listar, ver: vi.fn() } },
      { provide: PERMISOS_SESION, useValue: new PermisosDePrueba(permisos) },
      { provide: USUARIO_CABECERA, useValue: { nombreEmpresa: signal('Comercial Ejemplo') } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, ListaRolesComponent);
  await harness.fixture.whenStable();
  const html = harness.routeNativeElement!;
  const texto = () => (html.textContent ?? '').replace(/\s+/gu, ' ');
  return { harness, html, texto, listar, router: TestBed.inject(Router) };
}

describe('ListaRolesComponent', () => {
  it('«Nuevo rol» lleva al alta; sin el permiso de crear, no aparece', async () => {
    const { html } = await montar();
    expect(html.querySelector('a[href="/roles/nuevo"]')?.textContent).toContain('Nuevo rol');
    TestBed.resetTestingModule();
    const sinPermiso = await montar('/roles', ['auth.rol.ver']);
    expect(sinPermiso.html.querySelector('a[href="/roles/nuevo"]')).toBeNull();
  });

  it('pide la primera página sin filtros y muestra los roles', async () => {
    const { listar, texto, html } = await montar();
    expect(listar).toHaveBeenCalledWith({ texto: '', estado: 'todos' }, { pagina: 1, tamano: 20 });
    expect(texto()).toContain('Qué puede hacer cada grupo de personas en Comercial Ejemplo.');
    const filas = html.querySelectorAll('tr.lista-roles__fila');
    expect(filas).toHaveLength(3);
    expect(filas[0].textContent).toContain('Todos');
    expect(filas[2].textContent).toContain('Desactivado');
    expect(html.querySelector('.lista-roles__simbolo--administrador')).not.toBeNull();
  });

  it('lee los filtros de la URL y dice cuántos hay', async () => {
    const { listar, texto, html } = await montar('/roles?texto=caja&estado=activos');
    expect(listar).toHaveBeenCalledWith(
      { texto: 'caja', estado: 'activos' },
      { pagina: 1, tamano: 20 },
    );
    expect(texto()).toContain('2 activos');
    expect(html.querySelector<HTMLInputElement>('#roles-buscar')?.value).toBe('caja');
    expect(texto()).toContain('Limpiar filtros');
  });

  it('sin filtros no muestra «Limpiar filtros»', async () => {
    const { texto } = await montar();
    expect(texto()).not.toContain('Limpiar filtros');
  });

  it('el nombre es un enlace a la ficha', async () => {
    const { html } = await montar();
    const enlace = html.querySelector<HTMLAnchorElement>('.lista-roles__nombre');
    expect(enlace?.getAttribute('href')).toBe('/roles/r-0');
  });

  it('un clic en la fila abre la ficha', async () => {
    const { html, router, harness } = await montar();
    html.querySelectorAll<HTMLElement>('tr.lista-roles__fila')[1].click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/roles/r-1');
  });

  it('«Limpiar filtros» vuelve a la lista sin filtros', async () => {
    const { html, router, harness } = await montar('/roles?estado=desactivados');
    [...html.querySelectorAll('button')].find((b) => b.textContent?.includes('Limpiar'))?.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/roles');
  });

  it('sin roles: lo dice', async () => {
    const { listar, harness, texto } = await montar();
    listar.mockResolvedValue(pagina([]));
    await harness.navigateByUrl('/roles?texto=zzz');
    await harness.fixture.whenStable();
    expect(texto()).toContain('Ningún rol coincide con los filtros.');
  });
});
