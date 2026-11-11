import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EtiquetaLateralDirective } from './etiqueta-lateral.directive';

@Component({
  imports: [EtiquetaLateralDirective],
  template: `@if (visible()) {
    <a href="/" [appEtiquetaLateral]="texto()">I</a>
  }`,
})
class Prueba {
  readonly texto = signal<string | null>('Inicio');
  readonly visible = signal(true);
}

const etiqueta = () => document.body.querySelector<HTMLElement>('.etiqueta-lateral');

async function montar() {
  const fixture = TestBed.createComponent(Prueba);
  await fixture.whenStable();
  const enlace = () => (fixture.nativeElement as HTMLElement).querySelector('a');
  return { fixture, enlace };
}

describe('EtiquetaLateralDirective', () => {
  it('al pasar el mouse muestra el nombre (solo a la vista) y al salir lo quita', async () => {
    const { enlace } = await montar();
    enlace()?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(etiqueta()?.textContent).toBe('Inicio');
    expect(etiqueta()?.getAttribute('aria-hidden')).toBe('true');
    enlace()?.dispatchEvent(new MouseEvent('mouseleave'));
    expect(etiqueta()).toBeNull();
  });

  it('con Tab también, y nunca deja dos', async () => {
    const { enlace } = await montar();
    enlace()?.dispatchEvent(new FocusEvent('focusin'));
    enlace()?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.body.querySelectorAll('.etiqueta-lateral')).toHaveLength(1);
    enlace()?.dispatchEvent(new FocusEvent('focusout'));
    expect(etiqueta()).toBeNull();
  });

  it('con null no muestra nada', async () => {
    const { fixture, enlace } = await montar();
    fixture.componentInstance.texto.set(null);
    await fixture.whenStable();
    enlace()?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(etiqueta()).toBeNull();
  });

  it('si el enlace desaparece con la etiqueta a la vista, la quita', async () => {
    const { fixture, enlace } = await montar();
    enlace()?.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.componentInstance.visible.set(false);
    await fixture.whenStable();
    expect(etiqueta()).toBeNull();
  });
});
