import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Íconos de `public/iconos.svg`. Un ícono nuevo: su `<symbol>` en ese archivo y su nombre aquí. */
export type NombreIcono =
  | 'menu'
  | 'inicio'
  | 'expandir'
  | 'ver'
  | 'ocultar'
  | 'salir'
  | 'usuario'
  | 'candado'
  | 'desbloquear'
  | 'alerta'
  | 'escudo'
  | 'flecha-derecha'
  | 'llave'
  | 'listo'
  | 'informacion'
  | 'empresa'
  | 'selector'
  | 'siguiente'
  | 'volver'
  | 'buscar'
  | 'filtros'
  | 'roles'
  | 'desactivar'
  | 'reactivar'
  | 'agregar'
  | 'usuarios'
  | 'quitar-acceso'
  | 'copiar'
  | 'mas'
  | 'bitacora'
  | 'calendario'
  | 'historia'
  | 'cerrar';

/**
 * Ícono decorativo: el lector de pantalla no lo lee. Un botón de solo ícono lleva su
 * `aria-label` (docs/arquitectura-frontend.md, 8.4). De línea: toma el color del texto.
 *
 * Uso: `<app-icono nombre="inicio" />`.
 */
@Component({
  selector: 'app-icono',
  template: `<svg
    aria-hidden="true"
    focusable="false"
    [attr.width]="tamano()"
    [attr.height]="tamano()"
  >
    <use [attr.href]="'iconos.svg#' + nombre()" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconoComponent {
  readonly nombre = input.required<NombreIcono>();
  /** En píxeles. */
  readonly tamano = input(24);
}
