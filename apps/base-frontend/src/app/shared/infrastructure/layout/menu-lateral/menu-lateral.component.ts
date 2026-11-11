import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { EtiquetaLateralDirective } from '../etiqueta-lateral/etiqueta-lateral.directive';
import { IconoComponent } from '../icono/icono.component';
import type { SeccionMenu } from '../menu';
import { guardarSeccionesCerradas, leerSeccionesCerradas } from './secciones-cerradas';

/**
 * Menú por secciones que se abren y se cierran; el navegador recuerda cuáles quedaron cerradas.
 * Estrecho (en la PC): solo los íconos de todas las opciones, sin títulos de sección; el nombre,
 * al pasar el mouse o con Tab.
 */
@Component({
  selector: 'app-menu-lateral',
  imports: [RouterLink, RouterLinkActive, IconoComponent, EtiquetaLateralDirective],
  templateUrl: './menu-lateral.component.html',
  styleUrl: './menu-lateral.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuLateralComponent {
  readonly secciones = input.required<readonly SeccionMenu[]>();
  readonly estrecho = input(false);
  /** Al elegir una opción (en el celular, el layout cierra el menú). */
  readonly elegido = output();

  protected readonly cerradas = signal(leerSeccionesCerradas());

  protected alternar(id: string): void {
    const cerradas = new Set(this.cerradas());
    if (cerradas.has(id)) cerradas.delete(id);
    else cerradas.add(id);
    this.cerradas.set(cerradas);
    guardarSeccionesCerradas(cerradas);
  }
}
