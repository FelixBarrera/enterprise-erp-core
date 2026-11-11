import { TestBed } from '@angular/core/testing';
import {
  CONSULTAR_SALUD_PORT,
  type ConsultarSaludPort,
} from '../../../../application/ports/in/consultar-salud.port';
import { resumirSalud, type ResumenSalud } from '../../../../domain/estado-salud';
import { EstadoServicioComponent } from './estado-servicio.component';

function montar(execute: () => Promise<ResumenSalud>) {
  const puerto: ConsultarSaludPort = { execute };
  TestBed.configureTestingModule({
    imports: [EstadoServicioComponent],
    providers: [{ provide: CONSULTAR_SALUD_PORT, useValue: puerto }],
  });
  const fixture = TestBed.createComponent(EstadoServicioComponent);
  fixture.detectChanges();
  // Sin zone.js, la prueba espera la respuesta y después a que se dibuje la pantalla.
  const respondido = async (): Promise<void> => {
    await Promise.resolve();
    await fixture.whenStable();
  };
  return { respondido, html: fixture.nativeElement as HTMLElement };
}

describe('EstadoServicioComponent', () => {
  it('mientras consulta, avisa que está revisando', () => {
    const { html } = montar(() => new Promise<ResumenSalud>(() => undefined));
    expect(html.querySelector('[role="status"]')?.textContent).toContain('Revisando el sistema…');
    expect(html.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it('con el sistema en marcha, lo muestra', async () => {
    const { respondido, html } = montar(() => Promise.resolve(resumirSalud('en-marcha')));
    await respondido();
    const mensaje = html.querySelector('[role="status"]');
    expect(mensaje?.textContent).toContain('El sistema está en marcha.');
    expect(mensaje?.classList.contains('mensaje--falla')).toBe(false);
    expect(html.querySelector('section')?.getAttribute('aria-busy')).toBe('false');
  });

  it('sin servidor, lo muestra como falla', async () => {
    const { respondido, html } = montar(() => Promise.resolve(resumirSalud('sin-servidor')));
    await respondido();
    const mensaje = html.querySelector('[role="status"]');
    expect(mensaje?.textContent).toContain('No hay conexión con el servidor.');
    expect(mensaje?.classList.contains('mensaje--falla')).toBe(true);
  });
});
