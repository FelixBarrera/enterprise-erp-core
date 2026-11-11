import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmacionService, type OpcionesConfirmacion } from './confirmacion.service';

const OPCIONES: OpcionesConfirmacion = {
  titulo: '¿Desactivar el cliente?',
  mensaje: 'No podrá operar hasta que se reactive.',
  textoConfirmar: 'Desactivar',
  peligro: true,
};

const dialogos = () => document.querySelectorAll<HTMLElement>('[role="alertdialog"]');

async function esperarDialogo(): Promise<HTMLElement> {
  await vi.waitFor(() => expect(dialogos()).toHaveLength(1));
  await TestBed.inject(ApplicationRef).whenStable();
  const [dialogo] = dialogos();
  if (!dialogo) throw new Error('No se abrió la confirmación');
  return dialogo;
}

function botones(dialogo: HTMLElement): {
  cancelar: HTMLButtonElement;
  confirmar: HTMLButtonElement;
} {
  const [cancelar, confirmar] = dialogo.querySelectorAll('button');
  if (!cancelar || !confirmar) throw new Error('Faltan botones');
  return { cancelar, confirmar };
}

describe('ConfirmacionService', () => {
  let confirmacion: ConfirmacionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    confirmacion = TestBed.inject(ConfirmacionService);
  });

  afterEach(async () => {
    await vi.waitFor(() => expect(dialogos()).toHaveLength(0));
  });

  it('muestra título, mensaje y botones; enlazados para el lector de pantalla', async () => {
    const respuesta = confirmacion.confirmar(OPCIONES);
    const dialogo = await esperarDialogo();

    const titulo = dialogo.querySelector('h2');
    const mensaje = dialogo.querySelector('p');
    expect(titulo?.textContent).toContain('¿Desactivar el cliente?');
    expect(mensaje?.textContent).toContain('No podrá operar hasta que se reactive.');
    expect(dialogo.getAttribute('aria-labelledby')).toBe(titulo?.id);
    expect(dialogo.getAttribute('aria-describedby')).toBe(mensaje?.id);

    const { cancelar, confirmar } = botones(dialogo);
    expect(cancelar.textContent).toContain('Cancelar');
    expect(confirmar.textContent).toContain('Desactivar');
    expect(confirmar.classList.contains('boton--peligro')).toBe(true);

    cancelar.click();
    expect(await respuesta).toBe(false);
  });

  it('el foco empieza en "Cancelar"', async () => {
    const respuesta = confirmacion.confirmar(OPCIONES);
    const dialogo = await esperarDialogo();
    await vi.waitFor(() => expect(document.activeElement).toBe(botones(dialogo).cancelar));
    botones(dialogo).cancelar.click();
    await respuesta;
  });

  it('confirmar → true', async () => {
    const respuesta = confirmacion.confirmar(OPCIONES);
    botones(await esperarDialogo()).confirmar.click();
    expect(await respuesta).toBe(true);
  });

  it('Escape → false', async () => {
    const respuesta = confirmacion.confirmar(OPCIONES);
    const dialogo = await esperarDialogo();
    dialogo.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    expect(await respuesta).toBe(false);
  });

  it('sin "peligro", el botón de confirmar es el principal', async () => {
    const respuesta = confirmacion.confirmar({ ...OPCIONES, peligro: undefined });
    const { confirmar } = botones(await esperarDialogo());
    expect(confirmar.classList.contains('boton--primario')).toBe(true);
    expect(confirmar.classList.contains('boton--peligro')).toBe(false);
    confirmar.click();
    await respuesta;
  });
});
