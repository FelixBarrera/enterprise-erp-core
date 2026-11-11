import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { duracionAvisoExito, NotificacionesService } from './notificaciones.service';

const dialogos = () =>
  document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');

async function dibujado(): Promise<void> {
  await TestBed.inject(ApplicationRef).whenStable();
}

/** Espera a que el diálogo aparezca (su código se carga con `import()`). */
async function esperarDialogo(): Promise<HTMLElement> {
  await vi.waitFor(() => expect(dialogos()).toHaveLength(1));
  await dibujado();
  const [dialogo] = dialogos();
  if (!dialogo) throw new Error('No se abrió el diálogo');
  return dialogo;
}

async function esperarCerrado(): Promise<void> {
  await vi.waitFor(() => expect(dialogos()).toHaveLength(0));
}

function teclaEscape(elemento: HTMLElement): void {
  elemento.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
  );
}

describe('NotificacionesService', () => {
  let avisos: NotificacionesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    avisos = TestBed.inject(NotificacionesService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('duracionAvisoExito', () => {
    it('entre 2,5 y 8 segundos según el largo del texto', () => {
      expect(duracionAvisoExito('Listo')).toBe(2500);
      expect(duracionAvisoExito('x'.repeat(50))).toBe(4500);
      expect(duracionAvisoExito('x'.repeat(500))).toBe(8000);
    });
  });

  it('error: un modal "alertdialog" con el texto que espera "Aceptar"', async () => {
    const cerrado = avisos.error('No hay conexión con el servidor.');
    const dialogo = await esperarDialogo();

    expect(dialogo.getAttribute('role')).toBe('alertdialog');
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    const texto = dialogo.querySelector('p');
    expect(texto?.textContent).toContain('No hay conexión con el servidor.');
    expect(dialogo.getAttribute('aria-describedby')).toBe(texto?.id);

    const aceptar = dialogo.querySelector('button');
    expect(aceptar?.textContent).toContain('Aceptar');
    aceptar?.click();
    await cerrado;
    await esperarCerrado();
  });

  it('error: también se cierra con Escape', async () => {
    const cerrado = avisos.error('Algo falló');
    const dialogo = await esperarDialogo();
    teclaEscape(dialogo.querySelector('app-aviso') ?? dialogo);
    await cerrado;
    await esperarCerrado();
  });

  it('el mismo error de varias peticiones a la vez se avisa una sola vez', async () => {
    const primero = avisos.error('Sin conexión');
    const segundo = avisos.error('Sin conexión');
    const dialogo = await esperarDialogo();
    await segundo;
    expect(dialogos()).toHaveLength(1);
    dialogo.querySelector('button')?.click();
    await primero;
    await esperarCerrado();
  });

  it('éxito: sin botón y se cierra solo pasado su tiempo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const texto = 'Cliente registrado';
    const cerrado = avisos.exito(texto);
    const dialogo = await esperarDialogo();

    expect(dialogo.getAttribute('role')).toBe('dialog');
    expect(dialogo.textContent).toContain(texto);
    expect(dialogo.querySelector('button')).toBeNull();

    vi.advanceTimersByTime(duracionAvisoExito(texto) - 100);
    expect(dialogos()).toHaveLength(1);
    vi.advanceTimersByTime(200);
    await cerrado;
    await esperarCerrado();
  });
});
