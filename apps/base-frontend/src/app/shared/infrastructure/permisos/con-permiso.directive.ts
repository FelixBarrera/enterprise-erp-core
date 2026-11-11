import {
  computed,
  Directive,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { PERMISOS_SESION } from './permisos-sesion';

/**
 * Un botón (o cualquier parte de una pantalla) solo con su permiso; sin él, no se dibuja:
 * `<button *appConPermiso="'auth.usuario.crear'" …>Nuevo usuario</button>`. Si los permisos
 * cambian (llegan de nuevo con cada refresh), aparece o desaparece solo. **Ocultar no es
 * proteger**: el backend responde 403 igual.
 */
@Directive({ selector: '[appConPermiso]' })
export class ConPermisoDirective {
  readonly appConPermiso = input.required<string>();

  private readonly permisos = inject(PERMISOS_SESION);
  private readonly plantilla = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly contenedor = inject(ViewContainerRef);
  private readonly visible = computed(() => this.permisos.tiene(this.appConPermiso()));

  constructor() {
    // Una directiva estructural dibuja o quita su plantilla: no hay otra forma que un effect.
    effect(() => {
      const visible = this.visible();
      if (visible && this.contenedor.length === 0) {
        this.contenedor.createEmbeddedView(this.plantilla);
      } else if (!visible) {
        this.contenedor.clear();
      }
    });
  }
}
