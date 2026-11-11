import { TestBed } from '@angular/core/testing';
import { BarraCargaComponent } from './barra-carga.component';

describe('BarraCargaComponent', () => {
  it('la barra aparece mientras carga, con su nombre para el lector de pantalla', async () => {
    const fixture = TestBed.createComponent(BarraCargaComponent);
    const html = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('activa', false);
    await fixture.whenStable();
    expect(html.querySelector('mat-progress-bar')).toBeNull();
    fixture.componentRef.setInput('activa', true);
    await fixture.whenStable();
    expect(html.querySelector('mat-progress-bar')?.getAttribute('aria-label')).toBe('Cargando');
  });
});
