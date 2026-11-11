import { TestBed } from '@angular/core/testing';
import { IconoComponent } from './icono.component';

describe('IconoComponent', () => {
  it('usa el dibujo de iconos.svg y el lector de pantalla no lo lee', async () => {
    const fixture = TestBed.createComponent(IconoComponent);
    fixture.componentRef.setInput('nombre', 'inicio');
    fixture.componentRef.setInput('tamano', 20);
    await fixture.whenStable();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.querySelector('use')?.getAttribute('href')).toBe('iconos.svg#inicio');
  });
});
