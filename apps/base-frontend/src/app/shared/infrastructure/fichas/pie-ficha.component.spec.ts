import { ChangeDetectionStrategy, Component, ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Huella, PieFichaComponent } from './pie-ficha.component';

function montar(creado: Huella | null, modificado: Huella | null, textoCreado?: string) {
  const fixture = TestBed.createComponent(PieFichaComponent);
  const ref: ComponentRef<PieFichaComponent> = fixture.componentRef;
  ref.setInput('creado', creado);
  ref.setInput('modificado', modificado);
  if (textoCreado !== undefined) ref.setInput('textoCreado', textoCreado);
  fixture.detectChanges();
  const html = fixture.nativeElement as HTMLElement;
  return () => (html.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

describe('PieFichaComponent', () => {
  it('creado y modificado, en la zona del negocio', () => {
    const texto = montar(
      { en: '2026-11-02T15:15:00.000Z', por: 'ana.perez' },
      { en: '2026-11-05T21:40:00.000Z', por: 'carlos.mora' },
    );
    expect(texto()).toBe(
      'Creado el 02/11/2026 10:15 por ana.perez Modificado el 05/11/2026 16:40 por carlos.mora',
    );
  });

  it('lo que hizo el sistema, y solo lo que llegó', () => {
    const texto = montar({ en: '2026-11-02T15:15:00.000Z', por: null }, null);
    expect(texto()).toBe('Creado el 02/11/2026 10:15 por el sistema');
  });

  it('con otro texto para el alta (el acceso de un usuario)', () => {
    const texto = montar(
      { en: '2026-11-02T15:15:00.000Z', por: 'ana.perez' },
      null,
      'Con acceso desde el',
    );
    expect(texto()).toBe('Con acceso desde el 02/11/2026 10:15 por ana.perez');
  });

  it('sin ninguno, nada', () => {
    expect(montar(null, null)()).toBe('');
  });

  it('un enlace a la derecha («Ver historia»), con `pieAccion`', async () => {
    @Component({
      imports: [PieFichaComponent],
      template: `<app-pie-ficha [creado]="null" [modificado]="null">
        <a pieAccion class="pie-ficha__enlace" href="/bitacora">Ver historia</a>
        <span>No va</span>
      </app-pie-ficha>`,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class ConEnlace {}
    const fixture = TestBed.createComponent(ConEnlace);
    await fixture.whenStable();
    const pie = (fixture.nativeElement as HTMLElement).querySelector('footer.pie-ficha');
    expect(pie?.textContent?.trim()).toBe('Ver historia');
  });

  it('sin nada que mostrar, el pie queda vacío (y no se ve)', () => {
    const fixture = TestBed.createComponent(PieFichaComponent);
    fixture.componentRef.setInput('creado', null);
    fixture.componentRef.setInput('modificado', null);
    fixture.detectChanges();
    const pie = (fixture.nativeElement as HTMLElement).querySelector('footer.pie-ficha');
    expect(pie?.children).toHaveLength(0);
  });
});
