import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { SeccionMenu } from '../menu';
import { MenuLateralComponent } from './menu-lateral.component';

@Component({ template: '' })
class Vacia {}

const SECCIONES: readonly SeccionMenu[] = [
  { id: 'general', titulo: 'General', opciones: [{ texto: 'Inicio', ruta: '/', icono: 'inicio' }] },
  {
    id: 'clientes',
    titulo: 'Clientes',
    opciones: [{ texto: 'Lista de clientes', ruta: '/clientes', icono: 'menu' }],
  },
];

async function montar(url = '/') {
  TestBed.configureTestingModule({
    imports: [MenuLateralComponent],
    providers: [
      provideRouter([
        { path: '', component: Vacia },
        { path: 'clientes', component: Vacia, children: [{ path: ':id', component: Vacia }] },
      ]),
    ],
  });
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(MenuLateralComponent);
  fixture.componentRef.setInput('secciones', SECCIONES);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const boton = (titulo: string) =>
    [...html.querySelectorAll<HTMLButtonElement>('.seccion__boton')].find((b) =>
      b.textContent?.includes(titulo),
    );
  const enlace = (texto: string) =>
    [...html.querySelectorAll<HTMLAnchorElement>('a')].find((a) => a.textContent?.includes(texto));
  return { fixture, html, boton, enlace };
}

describe('MenuLateralComponent', () => {
  beforeEach(() => localStorage.clear());

  it('muestra las secciones abiertas y sus opciones', async () => {
    const { html, boton } = await montar();
    expect(html.querySelectorAll('.seccion')).toHaveLength(2);
    expect(boton('General')?.getAttribute('aria-expanded')).toBe('true');
    expect(boton('General')?.getAttribute('aria-controls')).toBe('menu-seccion-general');
    expect(html.querySelector('#menu-seccion-general')?.textContent).toContain('Inicio');
  });

  it('cierra y abre una sección, y el navegador la recuerda', async () => {
    const primero = await montar();
    primero.boton('Clientes')?.click();
    await primero.fixture.whenStable();
    expect(primero.boton('Clientes')?.getAttribute('aria-expanded')).toBe('false');
    expect(primero.html.querySelector<HTMLElement>('#menu-seccion-clientes')?.hidden).toBe(true);

    TestBed.resetTestingModule();
    const segundo = await montar();
    expect(segundo.boton('Clientes')?.getAttribute('aria-expanded')).toBe('false');
    expect(segundo.boton('General')?.getAttribute('aria-expanded')).toBe('true');

    segundo.boton('Clientes')?.click();
    await segundo.fixture.whenStable();
    expect(segundo.boton('Clientes')?.getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem('menu.secciones-cerradas')).toBe('[]');
  });

  it('marca la pantalla actual con aria-current (el inicio, solo si es exacto)', async () => {
    const { enlace } = await montar('/clientes/123');
    expect(enlace('Lista de clientes')?.getAttribute('aria-current')).toBe('page');
    expect(enlace('Lista de clientes')?.classList).toContain('opcion--activa');
    expect(enlace('Inicio')?.hasAttribute('aria-current')).toBe(false);
  });

  it('avisa cuando se elige una opción', async () => {
    const { fixture, enlace } = await montar();
    let elegidas = 0;
    fixture.componentInstance.elegido.subscribe(() => elegidas++);
    enlace('Lista de clientes')?.click();
    expect(elegidas).toBe(1);
  });
});
