import { TestBed } from '@angular/core/testing';
import { MARCA } from './marca';
import { MarcaComponent } from './marca.component';

describe('MarcaComponent', () => {
  it('se lee el nombre de la marca y el símbolo queda fuera del lector de pantalla', async () => {
    const fixture = TestBed.createComponent(MarcaComponent);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent?.replace(/\s+/gu, ' ').trim()).toBe(MARCA.nombre);
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('tono')).toBe('oscuro');
  });

  it('sobre el azul oscuro, el fondo del símbolo es translúcido', async () => {
    const fixture = TestBed.createComponent(MarcaComponent);
    fixture.componentRef.setInput('tono', 'claro');
    fixture.componentRef.setInput('tamano', 'grande');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('tono')).toBe('claro');
    expect(host.getAttribute('tamano')).toBe('grande');
    expect(host.querySelector('rect')?.getAttribute('fill-opacity')).toBe('0.08');
  });
});
