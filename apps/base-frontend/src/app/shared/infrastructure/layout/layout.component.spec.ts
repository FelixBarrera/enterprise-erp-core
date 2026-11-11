import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PermisosDePrueba } from '../permisos/permisos-de-prueba';
import { PERMISOS_SESION } from '../permisos/permisos-sesion';
import { ETIQUETA_INICIO, LayoutComponent, TEXTO_PIE_RESPALDO } from './layout.component';
import { MENU_APLICACION, type SeccionMenu } from './menu';
import { SelectorEmpresaService } from './selector-empresa/selector-empresa.service';
import { type EmpresaCabecera, USUARIO_CABECERA, type UsuarioCabecera } from './usuario-cabecera';

@Component({ template: '<h1>Pantalla de prueba</h1>' })
class Pantalla {}

const MENU: readonly SeccionMenu[] = [
  {
    id: 'general',
    titulo: 'General',
    opciones: [
      { texto: 'Inicio', ruta: '/', icono: 'inicio' },
      { texto: 'Otra', ruta: '/otra', icono: 'menu' },
    ],
  },
  {
    id: 'administracion',
    titulo: 'Administración',
    opciones: [{ texto: 'Usuarios', ruta: '/otra', icono: 'menu', permiso: 'auth.usuario.ver' }],
  },
];

function usuarioDePrueba(salir: () => Promise<void> = () => Promise.resolve()) {
  return {
    nombreCompleto: signal<string | null>('Ana Pérez'),
    nombreUsuario: signal<string | null>('ana.perez'),
    nombreEmpresa: signal<string | null>('Empresa Uno'),
    empresaActivaId: signal<string | null>('e-1'),
    empresas: signal<readonly EmpresaCabecera[]>([{ id: 'e-1', nombre: 'Empresa Uno' }]),
    esAdministrador: signal(false),
    cambiarEmpresa: vi.fn(() => Promise.resolve()),
    irACambiarContrasena: vi.fn(() => Promise.resolve()),
    salir: vi.fn(salir),
  } satisfies UsuarioCabecera;
}

async function montar(
  pantallaChica: boolean,
  usuario = usuarioDePrueba(),
  permisos = new PermisosDePrueba(),
) {
  const selector = { abrir: vi.fn(() => Promise.resolve()) };
  const tamano = new BehaviorSubject<BreakpointState>({ matches: pantallaChica, breakpoints: {} });
  TestBed.configureTestingModule({
    imports: [LayoutComponent],
    deferBlockBehavior: DeferBlockBehavior.Manual,
    providers: [
      provideRouter([
        { path: '', component: Pantalla },
        { path: 'otra', component: Pantalla, data: { miga: 'Otra' } },
      ]),
      { provide: MENU_APLICACION, useValue: MENU },
      { provide: BreakpointObserver, useValue: { observe: () => tamano.asObservable() } },
      { provide: USUARIO_CABECERA, useValue: usuario },
      { provide: PERMISOS_SESION, useValue: permisos },
      { provide: SelectorEmpresaService, useValue: selector },
    ],
  });
  await TestBed.compileComponents();
  const fixture = TestBed.createComponent(LayoutComponent);
  await TestBed.inject(Router).navigateByUrl('/');
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const botonMenu = () => html.querySelector<HTMLButtonElement>('.cabecera__menu');
  const menu = () => html.querySelector<HTMLElement>('mat-sidenav');
  const listo = () => fixture.whenStable();
  const cambiarTamano = async (chica: boolean) => {
    tamano.next({ matches: chica, breakpoints: {} });
    await listo();
  };
  const ir = async (url: string) => {
    await TestBed.inject(Router).navigateByUrl(url);
    await listo();
  };
  return { fixture, html, botonMenu, menu, listo, cambiarTamano, ir, usuario, selector };
}

describe('LayoutComponent', () => {
  beforeEach(() => localStorage.clear());

  it('dibuja el menú con la marca, la cabecera, la pantalla y el pie', async () => {
    const { html } = await montar(false);
    expect(html.querySelector(`mat-sidenav a[aria-label="${ETIQUETA_INICIO}"]`)).not.toBeNull();
    expect(html.querySelector('nav[aria-label="Menú principal"]')?.textContent).toContain('Inicio');
    expect(html.querySelector('main h1')?.textContent).toBe('Pantalla de prueba');
    expect(html.querySelector('footer')?.textContent).toContain(TEXTO_PIE_RESPALDO);
  });

  it('en la PC, las migas de pan en la cabecera (en el inicio y en el celular, no)', async () => {
    const { html, ir, cambiarTamano } = await montar(false);
    const migas = () => html.querySelector('header nav[aria-label="Ruta"]');
    expect(migas()).toBeNull();
    await ir('/otra');
    expect(migas()?.textContent).toContain('General');
    expect(migas()?.querySelector('[aria-current="page"]')?.textContent).toBe('Otra');
    await cambiarTamano(true);
    expect(migas()).toBeNull();
  });

  it('el menú muestra solo lo que permite la sesión y cambia con sus permisos', async () => {
    const permisos = new PermisosDePrueba();
    const { html, listo } = await montar(false, usuarioDePrueba(), permisos);
    const nav = () => html.querySelector('nav[aria-label="Menú principal"]')?.textContent ?? '';
    expect(nav()).not.toContain('Administración');
    expect(nav()).not.toContain('Usuarios');
    permisos.fijar(['auth.usuario.ver']);
    await listo();
    expect(nav()).toContain('Administración');
    expect(nav()).toContain('Usuarios');
  });

  it('en la PC el menú empieza ancho, al lado, y el botón lo deja estrecho sin ocultarlo', async () => {
    const { html, botonMenu, menu, listo } = await montar(false);
    expect(botonMenu()?.getAttribute('aria-label')).toBe('Menú');
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('true');
    expect(menu()?.classList).toContain('mat-drawer-side');
    expect(menu()?.classList).toContain('mat-drawer-opened');
    expect(menu()?.classList).not.toContain('menu--estrecho');

    botonMenu()?.click();
    await listo();
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');
    expect(menu()?.classList).toContain('mat-drawer-opened');
    expect(menu()?.classList).toContain('menu--estrecho');
    // Solo el símbolo; los nombres, para el lector de pantalla.
    expect(html.querySelector('.marca__nombre')).toBeNull();
    expect(html.querySelector('.opcion span')?.classList).toContain('oculto-visual');
    expect(localStorage.getItem('menu.estrecho')).toBe('si');

    botonMenu()?.click();
    await listo();
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('true');
    expect(menu()?.classList).not.toContain('menu--estrecho');
    expect(localStorage.getItem('menu.estrecho')).toBeNull();
  });

  it('en la PC recuerda el menú estrecho al volver a abrir la página', async () => {
    localStorage.setItem('menu.estrecho', 'si');
    const { botonMenu, menu } = await montar(false);
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');
    expect(menu()?.classList).toContain('menu--estrecho');
  });

  it('estrecho, el nombre de la opción aparece al pasar el mouse', async () => {
    localStorage.setItem('menu.estrecho', 'si');
    const { html } = await montar(false);
    html.querySelector('a[href="/otra"]')?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.body.querySelector('.etiqueta-lateral')?.textContent).toBe('Otra');
    html.querySelector('a[href="/otra"]')?.dispatchEvent(new MouseEvent('mouseleave'));
  });

  it('en la PC la marca va siempre en el menú, no en la cabecera', async () => {
    const { html, botonMenu, listo } = await montar(false);
    const marcaEnCabecera = () => html.querySelector(`header a[aria-label="${ETIQUETA_INICIO}"]`);
    expect(marcaEnCabecera()).toBeNull();
    botonMenu()?.click();
    await listo();
    expect(marcaEnCabecera()).toBeNull();
  });

  it('en el celular el menú nunca es estrecho, aunque en la PC lo esté', async () => {
    localStorage.setItem('menu.estrecho', 'si');
    const { botonMenu, menu, listo } = await montar(true);
    botonMenu()?.click();
    await listo();
    expect(menu()?.classList).not.toContain('menu--estrecho');
  });

  it('en el celular la marca va en la cabecera', async () => {
    const { html } = await montar(true);
    expect(html.querySelector(`header a[aria-label="${ETIQUETA_INICIO}"]`)).not.toBeNull();
  });

  it('en la PC, elegir una opción no cierra el menú', async () => {
    const { html, botonMenu, listo } = await montar(false);
    html.querySelector<HTMLAnchorElement>('a[href="/otra"]')?.click();
    await listo();
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('en el celular el menú empieza cerrado, va encima y se cierra al elegir', async () => {
    const { html, botonMenu, menu, listo } = await montar(true);
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');
    expect(menu()?.classList).toContain('mat-drawer-over');

    botonMenu()?.click();
    await listo();
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('true');

    html.querySelector<HTMLAnchorElement>('a[href="/otra"]')?.click();
    await listo();
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('al cambiar de tamaño, cada pantalla recuerda lo suyo', async () => {
    const { botonMenu, listo, cambiarTamano } = await montar(false);
    botonMenu()?.click(); // estrecho en la PC
    await listo();

    await cambiarTamano(true);
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');
    botonMenu()?.click(); // abierto en el celular
    await listo();

    await cambiarTamano(false);
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');
    await cambiarTamano(true);
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('en el celular, Escape o un toque en el fondo cierran el menú', async () => {
    const { fixture, botonMenu, menu, listo } = await montar(true);
    botonMenu()?.click();
    await listo();
    menu()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await listo();
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');

    botonMenu()?.click();
    await listo();
    fixture.debugElement
      .query((n) => n.name === 'mat-sidenav-container')
      .triggerEventHandler('backdropClick');
    await listo();
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('en la PC, Escape no cierra el menú', async () => {
    const { botonMenu, menu, listo } = await montar(false);
    menu()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await listo();
    expect(botonMenu()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('"Saltar al contenido" lleva el foco a la pantalla', async () => {
    const { html } = await montar(false);
    html.querySelector<HTMLButtonElement>('.saltar')?.click();
    expect(document.activeElement).toBe(html.querySelector('main'));
  });

  describe('usuario en la cabecera', () => {
    const botonUsuario = (html: HTMLElement) =>
      html.querySelector<HTMLButtonElement>('.cabecera__usuario');

    it('mientras se descarga el menú, el mismo botón: iniciales, nombre y su usuario', async () => {
      const { html } = await montar(false);
      const boton = botonUsuario(html);
      expect(boton?.getAttribute('aria-label')).toBe('Menú del usuario: Ana Pérez');
      expect(boton?.getAttribute('aria-disabled')).toBe('true');
      expect(boton?.querySelector('.iniciales')?.textContent?.trim()).toBe('AP');
      expect(boton?.textContent).toContain('ana.perez');
    });

    it('al Administrador lo dice debajo del nombre', async () => {
      const usuario = usuarioDePrueba();
      usuario.esAdministrador.set(true);
      const { html } = await montar(false, usuario);
      expect(botonUsuario(html)?.textContent).toContain('Administrador');
      expect(botonUsuario(html)?.textContent).not.toContain('ana.perez');
    });

    it('después pone el menú del usuario', async () => {
      const { fixture, html, listo } = await montar(false);
      const [bloque] = await fixture.getDeferBlocks();
      await bloque.render(DeferBlockState.Complete);
      await listo();
      expect(html.querySelector('app-menu-usuario .cabecera__usuario')).not.toBeNull();
    });

    it('la empresa activa va en el menú lateral, con sus iniciales', async () => {
      const { html } = await montar(false);
      const empresa = html.querySelector('.menu__empresa')?.textContent ?? '';
      expect(empresa).toContain('Empresa Uno');
      expect(empresa).toContain('EU');
    });

    it('con una sola empresa, el recuadro no es un botón', async () => {
      const { html } = await montar(false);
      expect(html.querySelector('button.menu__empresa')).toBeNull();
    });

    it('con varias, el recuadro de la empresa abre «Cambiar de empresa»', async () => {
      const usuario = usuarioDePrueba();
      usuario.empresas.set([
        { id: 'e-1', nombre: 'Empresa Uno' },
        { id: 'e-2', nombre: 'Empresa Dos' },
      ]);
      const { html, selector } = await montar(false, usuario);
      const boton = html.querySelector<HTMLButtonElement>('button.menu__empresa');
      expect(boton?.getAttribute('aria-label')).toBe('Empresa: Empresa Uno. Cambiar de empresa');
      boton?.click();
      expect(selector.abrir).toHaveBeenCalledOnce();
    });

    it('en el celular, al abrir «Cambiar de empresa» se cierra el menú', async () => {
      const usuario = usuarioDePrueba();
      usuario.empresas.set([
        { id: 'e-1', nombre: 'Empresa Uno' },
        { id: 'e-2', nombre: 'Empresa Dos' },
      ]);
      const { html, botonMenu, listo, selector } = await montar(true, usuario);
      botonMenu()?.click();
      await listo();
      html.querySelector<HTMLButtonElement>('button.menu__empresa')?.click();
      await listo();
      expect(selector.abrir).toHaveBeenCalledOnce();
      expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');
    });

    it('sin sesión, no muestra nada del usuario ni de la empresa', async () => {
      const usuario = usuarioDePrueba();
      usuario.nombreCompleto.set(null);
      usuario.nombreEmpresa.set(null);
      const { html } = await montar(false, usuario);
      expect(botonUsuario(html)).toBeNull();
      expect(html.querySelector('.menu__empresa')).toBeNull();
    });
  });
});
