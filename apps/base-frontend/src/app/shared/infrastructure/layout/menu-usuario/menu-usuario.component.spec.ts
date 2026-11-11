import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type EmpresaCabecera, USUARIO_CABECERA, type UsuarioCabecera } from '../usuario-cabecera';
import { SelectorEmpresaService } from '../selector-empresa/selector-empresa.service';
import { MenuUsuarioComponent } from './menu-usuario.component';

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

async function montar(usuario = usuarioDePrueba()) {
  const selector = { abrir: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    imports: [MenuUsuarioComponent],
    providers: [
      { provide: USUARIO_CABECERA, useValue: usuario },
      { provide: SelectorEmpresaService, useValue: selector },
    ],
  });
  const fixture = TestBed.createComponent(MenuUsuarioComponent);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const listo = () => fixture.whenStable();
  const boton = () => html.querySelector<HTMLButtonElement>('.cabecera__usuario');
  const abrir = async () => {
    boton()?.click();
    await listo();
  };
  return { html, listo, boton, abrir, usuario, selector };
}

const panel = () => document.querySelector<HTMLElement>('.menu-usuario');
const botonSalir = () => document.querySelector<HTMLButtonElement>('.menu-usuario__salir');

describe('MenuUsuarioComponent', () => {
  it('el botón muestra las iniciales, el nombre y su usuario', async () => {
    const { boton } = await montar();
    expect(boton()?.getAttribute('aria-label')).toBe('Menú del usuario: Ana Pérez');
    expect(boton()?.getAttribute('aria-haspopup')).toBe('menu');
    expect(boton()?.querySelector('.iniciales')?.textContent?.trim()).toBe('AP');
    expect(boton()?.textContent).toContain('ana.perez');
  });

  it('al Administrador lo dice debajo del nombre', async () => {
    const usuario = usuarioDePrueba();
    usuario.esAdministrador.set(true);
    const { boton } = await montar(usuario);
    expect(boton()?.textContent).toContain('Administrador');
  });

  it('sin sesión, no muestra nada', async () => {
    const usuario = usuarioDePrueba();
    usuario.nombreCompleto.set(null);
    const { boton } = await montar(usuario);
    expect(boton()).toBeNull();
  });

  it('el menú dice quién es, la empresa activa y tiene «Salir»', async () => {
    const { abrir } = await montar();
    await abrir();
    const texto = panel()?.textContent ?? '';
    expect(texto).toContain('Ana Pérez');
    expect(texto).toContain('ana.perez');
    expect(texto).toContain('Empresa activa');
    expect(texto).toContain('Empresa Uno');
    expect(botonSalir()?.textContent).toContain('Salir');
  });

  it('con una sola empresa, no ofrece cambiarla', async () => {
    const { abrir } = await montar();
    await abrir();
    expect(document.querySelector('.menu-usuario__cambiar-empresa')).toBeNull();
  });

  it('con varias, «Cambiar de empresa» dice cuántas y abre la lista', async () => {
    const usuario = usuarioDePrueba();
    usuario.empresas.set([
      { id: 'e-1', nombre: 'Empresa Uno' },
      { id: 'e-2', nombre: 'Empresa Dos' },
      { id: 'e-3', nombre: 'Empresa Tres' },
    ]);
    const { abrir, selector } = await montar(usuario);
    await abrir();
    const boton = document.querySelector<HTMLButtonElement>('.menu-usuario__cambiar-empresa');
    expect(boton?.getAttribute('aria-label')).toBe('Cambiar de empresa (3)');
    expect(boton?.textContent).toContain('3');
    boton?.click();
    expect(selector.abrir).toHaveBeenCalledOnce();
  });

  it('«Cambiar contraseña» lleva a esa pantalla', async () => {
    const { abrir, usuario } = await montar();
    await abrir();
    const boton = document.querySelector<HTMLButtonElement>('.menu-usuario__cambiar-contrasena');
    expect(boton?.textContent).toContain('Cambiar contraseña');
    boton?.click();
    expect(usuario.irACambiarContrasena).toHaveBeenCalledOnce();
  });

  it('«Salir» cierra la sesión una sola vez y queda «Saliendo…» mientras tanto', async () => {
    const usuario = usuarioDePrueba(() => new Promise<void>(() => undefined));
    const { abrir, boton, listo } = await montar(usuario);
    await abrir();
    botonSalir()?.click();
    await listo();
    expect(usuario.salir).toHaveBeenCalledOnce();
    expect(boton()?.textContent).toContain('Saliendo…');
    expect(boton()?.disabled).toBe(true);
  });

  it('si salir falla (sin conexión), el menú vuelve a estar disponible', async () => {
    const usuario = usuarioDePrueba(() => Promise.reject(new Error('sin red')));
    const { abrir, boton, listo } = await montar(usuario);
    await abrir();
    botonSalir()?.click();
    await listo();
    await listo();
    expect(boton()?.disabled).toBe(false);
    expect(boton()?.textContent).not.toContain('Saliendo…');
  });
});
