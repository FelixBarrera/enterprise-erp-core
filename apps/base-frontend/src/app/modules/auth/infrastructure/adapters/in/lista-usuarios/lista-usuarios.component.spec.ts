import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Pagina, PedidoPagina } from '../../../../../../shared/domain/pagina';
import { ZONA_NEGOCIO } from '../../../../../../shared/infrastructure/fechas/zona-negocio';
import { USUARIO_CABECERA } from '../../../../../../shared/infrastructure/layout/usuario-cabecera';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { PermisosDePrueba } from '../../../../../../shared/infrastructure/permisos/permisos-de-prueba';
import { CONSULTAR_USUARIOS_PORT } from '../../../../application/ports/in/consultar-usuarios.port';
import {
  rolesAsignablesDePrueba,
  usuarioResumenDePrueba,
} from '../../../../application/testing/usuarios-de-prueba';
import type { FiltrosUsuarios, UsuarioResumen } from '../../../../domain/usuario';
import { ListaUsuariosComponent } from './lista-usuarios.component';

const ROL = '0190a4f2-1c2b-7000-8000-000000000201';

const USUARIOS: UsuarioResumen[] = [
  usuarioResumenDePrueba({
    id: 'u-0',
    nombreUsuario: 'ana.perez',
    nombreCompleto: 'Ana Pérez',
    roles: [{ id: 'r-admin', nombre: 'Administrador', esAdministrador: true, activo: true }],
  }),
  usuarioResumenDePrueba({
    roles: [
      { id: 'r-soporte', nombre: 'Soporte', esAdministrador: false, activo: true },
      { id: 'r-op', nombre: 'Operaciones', esAdministrador: false, activo: false },
    ],
  }),
  usuarioResumenDePrueba({
    id: 'u-2',
    nombreUsuario: 'lucia.torres',
    nombreCompleto: 'Lucía Torres',
    ultimoIngresoEn: null,
    bloqueadoHasta: '2026-11-06T15:00:00.000Z',
  }),
  usuarioResumenDePrueba({
    id: 'u-3',
    nombreUsuario: 'mateo.ruiz',
    nombreCompleto: 'Mateo Ruiz',
    ultimoIngresoEn: null,
    debeCambiarContrasena: true,
  }),
];

function pagina(elementos: UsuarioResumen[]): Pagina<UsuarioResumen> {
  return { elementos, total: elementos.length, pagina: 1, tamano: 20 };
}

async function montar(
  url = '/usuarios',
  roles = () => Promise.resolve(rolesAsignablesDePrueba()),
  permisos = ['auth.usuario.ver'],
) {
  const listar = vi.fn((_f: FiltrosUsuarios, _p: PedidoPagina) =>
    Promise.resolve(pagina(USUARIOS)),
  );
  TestBed.configureTestingModule({
    providers: [
      ...PROVIDERS_MATERIAL,
      provideRouter([
        { path: 'usuarios', component: ListaUsuariosComponent },
        { path: 'usuarios/:id', children: [] },
      ]),
      {
        provide: CONSULTAR_USUARIOS_PORT,
        useValue: { listar, ver: vi.fn(), rolesAsignables: vi.fn(roles) },
      },
      { provide: USUARIO_CABECERA, useValue: { nombreEmpresa: signal('Comercial Ejemplo') } },
      { provide: ZONA_NEGOCIO, useValue: signal('America/Guayaquil') },
      { provide: PERMISOS_SESION, useValue: new PermisosDePrueba(permisos) },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, ListaUsuariosComponent);
  await harness.fixture.whenStable();
  const html = harness.routeNativeElement!;
  const texto = () => (html.textContent ?? '').replace(/\s+/gu, ' ');
  return { harness, html, texto, listar, router: TestBed.inject(Router) };
}

describe('ListaUsuariosComponent', () => {
  it('«Nuevo usuario» solo con «Crear usuarios»', async () => {
    const sin = await montar();
    expect(sin.texto()).not.toContain('Nuevo usuario');
    TestBed.resetTestingModule();
    const con = await montar('/usuarios', undefined, ['auth.usuario.ver', 'auth.usuario.crear']);
    expect(con.html.querySelector('a[href="/usuarios/nuevo"]')?.textContent).toContain(
      'Nuevo usuario',
    );
  });

  it('pide la primera página sin filtros y muestra los usuarios', async () => {
    const { listar, texto, html } = await montar();
    expect(listar).toHaveBeenCalledWith(
      { texto: '', rol: '', estado: 'todos' },
      { pagina: 1, tamano: 20 },
    );
    expect(texto()).toContain(
      'Las personas que entran a Comercial Ejemplo y sus roles aquí.',
    );
    const filas = html.querySelectorAll('tr.lista-usuarios__fila');
    expect(filas).toHaveLength(4);
    expect(filas[0].textContent).toContain('AP');
    expect(filas[0].querySelector('.lista-usuarios__rol--administrador')).not.toBeNull();
    expect(filas[1].textContent).toContain('Operaciones (desactivado)');
    expect(filas[1].textContent).toContain('03/11/2026 11:28');
    expect(filas[2].textContent).toContain('Nunca entró');
    expect(filas[2].textContent).toContain('Bloqueado');
    expect(filas[3].querySelector('.estado--aviso')?.textContent).toBe(
      'Debe cambiar su contraseña',
    );
  });

  it('lee los filtros de la URL y dice cuántos hay', async () => {
    const { listar, texto, html } = await montar(`/usuarios?texto=ana&rol=${ROL}&estado=activos`);
    expect(listar).toHaveBeenCalledWith(
      { texto: 'ana', rol: ROL, estado: 'activos' },
      { pagina: 1, tamano: 20 },
    );
    expect(texto()).toContain('3 activos');
    expect(html.querySelector<HTMLInputElement>('#usuarios-buscar')?.value).toBe('ana');
  });

  it('el nombre es un enlace a la ficha y un clic en la fila la abre', async () => {
    const { html, router, harness } = await montar();
    const enlace = html.querySelector<HTMLAnchorElement>('.lista-usuarios__nombre');
    expect(enlace?.getAttribute('href')).toBe('/usuarios/u-0');
    html.querySelectorAll<HTMLElement>('tr.lista-usuarios__fila')[1].click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/usuarios/u-1');
  });

  it('«Limpiar filtros» vuelve a la lista sin filtros', async () => {
    const { html, router, harness } = await montar('/usuarios?estado=desactivados');
    [...html.querySelectorAll('button')].find((b) => b.textContent?.includes('Limpiar'))?.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/usuarios');
  });

  it('si no llegan los roles del filtro, la lista se ve igual', async () => {
    const { texto } = await montar('/usuarios', () => Promise.reject(new Error('sin red')));
    expect(texto()).toContain('Ana Pérez');
  });

  it('sin usuarios: lo dice', async () => {
    const { listar, harness, texto } = await montar();
    listar.mockResolvedValue(pagina([]));
    await harness.navigateByUrl('/usuarios?texto=zzz');
    await harness.fixture.whenStable();
    expect(texto()).toContain('Ningún usuario coincide con los filtros.');
  });
});
