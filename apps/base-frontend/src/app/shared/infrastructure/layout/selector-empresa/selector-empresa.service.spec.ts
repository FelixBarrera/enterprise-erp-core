import { Dialog } from '@angular/cdk/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type EmpresaCabecera, USUARIO_CABECERA, type UsuarioCabecera } from '../usuario-cabecera';
import { SelectorEmpresaService } from './selector-empresa.service';

function usuarioDePrueba(cambiar: () => Promise<void> = () => Promise.resolve()) {
  return {
    nombreCompleto: signal<string | null>('Ana Pérez'),
    nombreUsuario: signal<string | null>('ana.perez'),
    nombreEmpresa: signal<string | null>('Empresa Uno'),
    empresaActivaId: signal<string | null>('e-1'),
    empresas: signal<readonly EmpresaCabecera[]>([
      { id: 'e-1', nombre: 'Empresa Uno' },
      { id: 'e-2', nombre: 'Fondos Demo' },
    ]),
    esAdministrador: signal(false),
    cambiarEmpresa: vi.fn((_id: string) => cambiar()),
    irACambiarContrasena: vi.fn(() => Promise.resolve()),
    salir: vi.fn(() => Promise.resolve()),
  } satisfies UsuarioCabecera;
}

const dialogo = () => document.querySelector<HTMLElement>('[role="dialog"]');
const empresas = () => [...(dialogo()?.querySelectorAll<HTMLButtonElement>('.empresa') ?? [])];
const cancelar = () => dialogo()?.querySelector<HTMLButtonElement>('.boton--secundario');

async function abrir(usuario = usuarioDePrueba(), enCelular = false) {
  TestBed.configureTestingModule({
    providers: [
      { provide: USUARIO_CABECERA, useValue: usuario },
      { provide: BreakpointObserver, useValue: { isMatched: () => enCelular } },
    ],
  });
  await TestBed.inject(SelectorEmpresaService).abrir();
  const listo = () => TestBed.inject(ApplicationRef).whenStable();
  await vi.waitFor(() => expect(dialogo()).not.toBeNull());
  await listo();
  return { usuario, listo };
}

describe('SelectorEmpresaService', () => {
  afterEach(async () => {
    TestBed.inject(Dialog).closeAll();
    await vi.waitFor(() => expect(dialogo()).toBeNull());
  });

  it('muestra las empresas, con la activa marcada y el foco en ella', async () => {
    await abrir();
    const titulo = dialogo()?.querySelector('h2');
    expect(titulo?.textContent).toContain('Cambiar de empresa');
    expect(dialogo()?.getAttribute('aria-labelledby')).toBe(titulo?.id);
    const [activa, otra] = empresas();
    expect(activa?.textContent).toContain('Empresa Uno');
    expect(activa?.textContent).toContain('Empresa activa');
    expect(activa?.getAttribute('aria-current')).toBe('true');
    expect(otra?.textContent).toContain('Fondos Demo');
    expect(otra?.querySelector('.empresa__sigla')?.textContent).toBe('FD');
    expect(otra?.hasAttribute('aria-current')).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(activa));
  });

  it('elegir otra: la cambia, dice «Cambiando…» y no deja elegir de nuevo ni cerrar', async () => {
    const { usuario, listo } = await abrir(usuarioDePrueba(() => new Promise(() => undefined)));
    empresas()[1]?.click();
    await listo();
    expect(usuario.cambiarEmpresa).toHaveBeenCalledWith('e-2');
    expect(empresas()[1]?.textContent).toContain('Cambiando…');
    empresas()[1]?.click();
    cancelar()?.click();
    await listo();
    expect(usuario.cambiarEmpresa).toHaveBeenCalledOnce();
    expect(dialogo()).not.toBeNull();
  });

  it('si el cambio falla, se puede elegir otra vez (el aviso ya salió)', async () => {
    const { usuario, listo } = await abrir(usuarioDePrueba(() => Promise.reject(new Error('x'))));
    empresas()[1]?.click();
    await vi.waitFor(() => expect(empresas()[1]?.textContent).not.toContain('Cambiando…'));
    empresas()[1]?.click();
    await listo();
    expect(usuario.cambiarEmpresa).toHaveBeenCalledTimes(2);
  });

  it('elegir la activa solo cierra', async () => {
    const { usuario } = await abrir();
    empresas()[0]?.click();
    await vi.waitFor(() => expect(dialogo()).toBeNull());
    expect(usuario.cambiarEmpresa).not.toHaveBeenCalled();
  });

  it('en el celular sube desde abajo, con su asa', async () => {
    await abrir(usuarioDePrueba(), true);
    expect(dialogo()?.querySelector('app-selector-empresa')?.classList).toContain(
      'selector--celular',
    );
    expect(dialogo()?.querySelector('.selector__asa')).not.toBeNull();
  });
});
