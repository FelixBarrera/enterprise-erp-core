import { BreakpointObserver } from '@angular/cdk/layout';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type MatSidenavContainer, MatSidenavModule } from '@angular/material/sidenav';
import { RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { iniciales } from '../../domain/iniciales';
import { EtiquetaLateralDirective } from './etiqueta-lateral/etiqueta-lateral.directive';
import { IconoComponent } from './icono/icono.component';
import { MARCA } from './marca/marca';
import { MarcaComponent } from './marca/marca.component';
import { MENU_APLICACION, menuVisible } from './menu';
import { MigasComponent } from './migas/migas.component';
import { MigasService } from './migas/migas.service';
import { MenuUsuarioComponent } from './menu-usuario/menu-usuario.component';
import { MenuLateralComponent } from './menu-lateral/menu-lateral.component';
import { guardarMenuEstrecho, leerMenuEstrecho } from './menu-lateral/menu-estrecho';
import { PANTALLA_CHICA } from './pantalla-chica';
import { SelectorEmpresaService } from './selector-empresa/selector-empresa.service';
import { PERMISOS_SESION } from '../permisos/permisos-sesion';
import { USUARIO_CABECERA } from './usuario-cabecera';

/**
 * Textos de la empresa mientras no lleguen de la configuración del backend
 * (docs/arquitectura-frontend.md, 8.6).
 */
export const TEXTO_PIE_RESPALDO = MARCA.nombre;

/** Lo que lee el lector de pantalla en el logo, que lleva al inicio. */
export const ETIQUETA_INICIO = `${MARCA.nombre}: ir al inicio`;

/**
 * Menú lateral (marca, empresa activa y opciones por secciones), cabecera con el menú del usuario,
 * y pie. Las pantallas se dibujan en su `<router-outlet>`. En la PC el menú no se oculta: el botón
 * lo deja estrecho (solo íconos) o ancho, y el navegador lo recuerda; en el celular va encima.
 */
@Component({
  selector: 'app-layout',
  imports: [
    MatSidenavModule,
    RouterLink,
    RouterOutlet,
    EtiquetaLateralDirective,
    IconoComponent,
    MarcaComponent,
    MenuLateralComponent,
    MenuUsuarioComponent,
    MigasComponent,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {
  private readonly menuCompleto = inject(MENU_APLICACION);
  private readonly permisos = inject(PERMISOS_SESION);
  /** Solo lo que permite la sesión; cambia solo si los permisos cambian (al renovarla). */
  protected readonly menu = computed(() =>
    menuVisible(this.menuCompleto, (codigo) => this.permisos.tiene(codigo)),
  );
  protected readonly textoPie = TEXTO_PIE_RESPALDO;
  protected readonly etiquetaInicio = ETIQUETA_INICIO;
  /** «Administración › Roles › …»: en la PC, en la cabecera (en el celular no hay lugar). */
  protected readonly migas = inject(MigasService).migas;
  protected readonly usuario = inject(USUARIO_CABECERA);
  private readonly selectorEmpresa = inject(SelectorEmpresaService);
  private readonly injector = inject(Injector);

  /** El recuadro de la empresa abre «Cambiar de empresa» solo si trabaja en más de una. */
  protected readonly variasEmpresas = computed(() => this.usuario.empresas().length > 1);

  protected readonly inicialesUsuario = computed(() => {
    const nombre = this.usuario.nombreCompleto();
    return nombre === null ? '' : iniciales(nombre);
  });
  protected readonly inicialesEmpresa = computed(() => {
    const nombre = this.usuario.nombreEmpresa();
    return nombre === null ? '' : iniciales(nombre);
  });
  /** Debajo del nombre: «Administrador» o, si no lo es, su usuario (para el botón provisional). */
  protected readonly detalleUsuario = computed(() =>
    this.usuario.esAdministrador() ? 'Administrador' : this.usuario.nombreUsuario(),
  );

  protected readonly pantallaChica = toSignal(
    inject(BreakpointObserver)
      .observe(PANTALLA_CHICA)
      .pipe(map((estado) => estado.matches)),
    { initialValue: false },
  );

  // En la PC el menú siempre está a la vista: ancho o estrecho (lo último que eligió, recordado en
  // el navegador). En el celular empieza cerrado y se abre encima. Al girar la tablet, cada uno
  // conserva lo suyo.
  private readonly estrechoEnPc = signal(leerMenuEstrecho());
  private readonly abiertoEnCelular = signal(false);
  protected readonly estrecho = computed(() => !this.pantallaChica() && this.estrechoEnPc());
  /** Para el botón del menú: en la PC, «abierto» es ancho. */
  protected readonly menuAbierto = computed(() =>
    this.pantallaChica() ? this.abiertoEnCelular() : !this.estrechoEnPc(),
  );

  private readonly contenido = viewChild.required<ElementRef<HTMLElement>>('contenido');
  // Por su nombre en la plantilla: pedirlo por la clase sumaba 17 kB al paquete inicial.
  private readonly contenedor = viewChild.required<MatSidenavContainer>('contenedor');

  protected alternarMenu(): void {
    if (this.pantallaChica()) {
      this.abiertoEnCelular.update((abierto) => !abierto);
      return;
    }
    const estrecho = !this.estrechoEnPc();
    this.estrechoEnPc.set(estrecho);
    guardarMenuEstrecho(estrecho);
    // El menú cambió de ancho: el contenido se acomoda cuando ya se dibujó con el ancho nuevo.
    afterNextRender(() => this.contenedor().updateContentMargins(), { injector: this.injector });
  }

  /** En el celular, el menú se cierra: la lista sube desde abajo sobre la pantalla. */
  protected cambiarEmpresa(): void {
    this.cerrarEnCelular();
    void this.selectorEmpresa.abrir();
  }

  /**
   * Escape o un toque en el fondo, en el celular. El menú no se cierra solo (`disableClose`): sus
   * avisos llegan al terminar la animación y deshacían lo que se acababa de pedir con el botón.
   */
  protected cerrarEnCelular(): void {
    if (this.pantallaChica()) this.abiertoEnCelular.set(false);
  }

  /** "Saltar al contenido": para quien usa el teclado, sin recorrer todo el menú. */
  protected irAlContenido(): void {
    this.contenido().nativeElement.focus();
  }
}
