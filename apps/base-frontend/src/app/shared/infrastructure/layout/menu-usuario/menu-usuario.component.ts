import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { iniciales } from '../../../domain/iniciales';
import { IconoComponent } from '../icono/icono.component';
import { SelectorEmpresaService } from '../selector-empresa/selector-empresa.service';
import { USUARIO_CABECERA } from '../usuario-cabecera';

/**
 * El botón del usuario en la cabecera y su menú: quién es, la empresa activa, «Cambiar de empresa»
 * (si trabaja en más de una, con cuántas tiene), «Cambiar contraseña» y «Salir». El layout lo
 * descarga apenas termina de cargar la página (`@defer`): el menú de Material no pesa en el
 * arranque. Mientras tanto se ve el mismo botón.
 */
@Component({
  selector: 'app-menu-usuario',
  imports: [MatMenuModule, IconoComponent],
  templateUrl: './menu-usuario.component.html',
  styles: `
    :host {
      display: flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuUsuarioComponent {
  protected readonly usuario = inject(USUARIO_CABECERA);
  private readonly selectorEmpresa = inject(SelectorEmpresaService);
  protected readonly saliendo = signal(false);

  protected readonly iniciales = computed(() => {
    const nombre = this.usuario.nombreCompleto();
    return nombre === null ? '' : iniciales(nombre);
  });
  /** Debajo del nombre: «Administrador» o, si no lo es, su usuario. */
  protected readonly detalle = computed(() =>
    this.usuario.esAdministrador() ? 'Administrador' : this.usuario.nombreUsuario(),
  );

  /** Cuántas empresas tiene; «Cambiar de empresa» solo aparece si son más de una. */
  protected readonly cuantasEmpresas = computed(() => this.usuario.empresas().length);

  protected cambiarEmpresa(): void {
    void this.selectorEmpresa.abrir();
  }

  protected irACambiarContrasena(): void {
    void this.usuario.irACambiarContrasena();
  }

  /** Si el backend no responde, la sesión sigue: el aviso ya lo mostró el interceptor. */
  protected async salir(): Promise<void> {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    try {
      await this.usuario.salir();
    } catch {
      this.saliendo.set(false);
    }
  }
}
