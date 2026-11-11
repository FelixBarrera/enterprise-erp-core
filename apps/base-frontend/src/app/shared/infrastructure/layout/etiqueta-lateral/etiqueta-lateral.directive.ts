import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject, input, type OnDestroy, Renderer2 } from '@angular/core';

/**
 * En el menú estrecho (solo íconos), el nombre de la opción a la derecha, al pasar el mouse o al
 * llegar con Tab. Va al final del `<body>` con posición fija: dentro del menú lo cortaría su
 * borde. Es solo para la vista (`aria-hidden`): el lector de pantalla ya lee el nombre del enlace.
 *
 * Uso: `<a [appEtiquetaLateral]="estrecho() ? 'Inicio' : null">`. Con `null`, no hace nada.
 */
@Directive({
  selector: '[appEtiquetaLateral]',
  host: {
    '(mouseenter)': 'mostrar()',
    '(focusin)': 'mostrar()',
    '(mouseleave)': 'quitar()',
    '(focusout)': 'quitar()',
  },
})
export class EtiquetaLateralDirective implements OnDestroy {
  readonly appEtiquetaLateral = input<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly documento = inject(DOCUMENT);
  private etiqueta: HTMLElement | null = null;

  protected mostrar(): void {
    const texto = this.appEtiquetaLateral();
    if (texto === null) return;
    this.quitar();
    const caja = this.host.nativeElement.getBoundingClientRect();
    const etiqueta = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(etiqueta, 'etiqueta-lateral');
    this.renderer.setAttribute(etiqueta, 'aria-hidden', 'true');
    this.renderer.setStyle(etiqueta, 'top', `${caja.top + caja.height / 2}px`);
    this.renderer.setStyle(etiqueta, 'left', `${caja.right + 10}px`);
    this.renderer.appendChild(etiqueta, this.renderer.createText(texto));
    this.renderer.appendChild(this.documento.body, etiqueta);
    this.etiqueta = etiqueta;
  }

  protected quitar(): void {
    if (this.etiqueta === null) return;
    this.renderer.removeChild(this.documento.body, this.etiqueta);
    this.etiqueta = null;
  }

  ngOnDestroy(): void {
    this.quitar();
  }
}
