import { Clipboard } from '@angular/cdk/clipboard';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ContrasenaTemporalService,
  type OpcionesContrasenaTemporal,
} from './contrasena-temporal.service';

const OPCIONES: OpcionesContrasenaTemporal = {
  titulo: 'Usuario creado',
  nombreUsuario: 'lucia.torres',
  contrasena: 'k7Rm3xTq9vWb',
  textoListo: 'Listo, ir a su ficha',
};

const dialogos = () => document.querySelectorAll<HTMLElement>('[role="dialog"]');
const listo = () => TestBed.inject(ApplicationRef).whenStable();

async function esperarDialogo(): Promise<HTMLElement> {
  await vi.waitFor(() => expect(dialogos()).toHaveLength(1));
  await listo();
  const [dialogo] = dialogos();
  if (!dialogo) throw new Error('No se abrió la ventana');
  return dialogo;
}

const boton = (dialogo: HTMLElement, texto: string) =>
  [...dialogo.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
const textoDe = (dialogo: HTMLElement) => (dialogo.textContent ?? '').replace(/\s+/gu, ' ');

describe('ContrasenaTemporalService', () => {
  const copiar = vi.fn<(texto: string) => boolean>();

  beforeEach(() => {
    copiar.mockReset().mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [{ provide: Clipboard, useValue: { copy: copiar } }],
    });
  });

  afterEach(async () => {
    await vi.waitFor(() => expect(dialogos()).toHaveLength(0));
  });

  it('muestra la contraseña, a quién es y que se ve una sola vez; enlazado para el lector', async () => {
    const cerrada = TestBed.inject(ContrasenaTemporalService).mostrar(OPCIONES);
    const dialogo = await esperarDialogo();

    expect(textoDe(dialogo)).toContain('Usuario creado');
    expect(textoDe(dialogo)).toContain('Esta es la contraseña temporal de lucia.torres');
    expect(dialogo.querySelector('output')?.textContent?.trim()).toBe('k7Rm3xTq9vWb');
    expect(textoDe(dialogo)).toContain('esta sola vez');
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(dialogo.getAttribute('aria-labelledby')).toBe(dialogo.querySelector('h2')?.id);

    boton(dialogo, 'Listo, ir a su ficha')!.click();
    await expect(cerrada).resolves.toBeUndefined();
  });

  it('«Copiar» la copia y lo dice', async () => {
    const cerrada = TestBed.inject(ContrasenaTemporalService).mostrar(OPCIONES);
    const dialogo = await esperarDialogo();

    boton(dialogo, 'Copiar')!.click();
    await listo();
    expect(copiar).toHaveBeenCalledWith('k7Rm3xTq9vWb');
    expect(boton(dialogo, 'Copiada')).toBeDefined();
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain(
      'Péguela donde la vaya a entregar',
    );

    boton(dialogo, 'Listo')!.click();
    await cerrada;
  });

  it('si el navegador no deja copiar: pide hacerlo a mano', async () => {
    copiar.mockReturnValue(false);
    const cerrada = TestBed.inject(ContrasenaTemporalService).mostrar(OPCIONES);
    const dialogo = await esperarDialogo();

    boton(dialogo, 'Copiar')!.click();
    await listo();
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain(
      'No se pudo copiar. Selecciónela y cópiela a mano.',
    );

    boton(dialogo, 'Listo')!.click();
    await cerrada;
  });

  it('Escape no la cierra: solo su botón (no se puede volver a ver)', async () => {
    const cerrada = TestBed.inject(ContrasenaTemporalService).mostrar(OPCIONES);
    const dialogo = await esperarDialogo();

    dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await listo();
    expect(dialogos()).toHaveLength(1);

    boton(dialogo, 'Listo')!.click();
    await cerrada;
  });
});
