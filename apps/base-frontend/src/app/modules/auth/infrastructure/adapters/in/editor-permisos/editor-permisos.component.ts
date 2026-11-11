import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { IconoComponent } from '../../../../../../shared/infrastructure/layout/icono/icono.component';
import {
  alternarGrupo,
  alternarPermiso,
  type CambioPermiso,
  cambioDePermiso,
  codigosDelCatalogo,
  filtrarCatalogo,
  type GrupoPermisos,
  type MarcaGrupo,
  marcaDelGrupo,
  type ReglaPermisos,
  sePuedeCambiar,
  textoMarcados,
} from '../../../../domain/permisos-rol';

const NADIE_DA = (): boolean => false;

interface PermisoEnPantalla {
  readonly codigo: string;
  readonly descripcion: string;
  readonly marcado: boolean;
  readonly cambiable: boolean;
  readonly cambio: CambioPermiso;
}

interface GrupoEnPantalla {
  readonly grupo: GrupoPermisos;
  readonly marca: MarcaGrupo;
  readonly marcados: number;
  readonly contador: string;
  /** Hay al menos uno que se puede cambiar (si no, su casilla no hace nada). */
  readonly cambiable: boolean;
  readonly permisos: readonly PermisoEnPantalla[];
}

/**
 * Los permisos de un rol, por módulo (docs/arquitectura-frontend.md, «Permisos de un rol»): «N de M»
 * en cada grupo, buscador, «Solo los marcados», la casilla que marca todo el grupo y, en cada uno
 * cambiado, «Se agrega» o «Se quita». Sin escalada (AUTH-D11 (2), decisión del usuario, 6.12a3): lo
 * que quien opera no tiene se ve bloqueado con «Usted no tiene este permiso», salvo que el rol ya lo
 * tuviera (quitarlo nunca da más poder). El backend lo revisa igual.
 *
 * `marcados` es de ida y vuelta: `[(marcados)]="marcados"`.
 */
@Component({
  selector: 'app-editor-permisos',
  imports: [
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    IconoComponent,
  ],
  host: { '[class.editor-permisos--solo-lectura]': '!editable()' },
  templateUrl: './editor-permisos.component.html',
  styleUrl: './editor-permisos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPermisosComponent {
  readonly catalogo = input.required<readonly GrupoPermisos[]>();
  readonly marcados = model.required<ReadonlySet<string>>();
  /** Lo guardado (en el alta, ninguno). */
  readonly originales = input<ReadonlySet<string>>(new Set());
  /** Si se puede cambiar algo (sin el permiso de editar, o el Administrador: solo lectura). */
  readonly editable = input(false);
  /** «Se agrega» y «Se quita» junto a cada cambio (en el alta todo es nuevo: no se muestran). */
  readonly mostrarCambios = input(true);
  /** Si quien opera tiene ese permiso. */
  readonly puedeDar = input<(codigo: string) => boolean>(NADIE_DA);

  protected readonly texto = signal('');
  protected readonly soloMarcados = signal(false);

  private readonly regla = computed<ReglaPermisos>(() => ({
    originales: this.originales(),
    puedeDar: this.puedeDar(),
  }));
  protected readonly total = computed(() => codigosDelCatalogo(this.catalogo()).length);
  protected readonly cantidadMarcados = computed(() => this.marcados().size);
  protected readonly hayFiltro = computed(() => this.texto().trim() !== '' || this.soloMarcados());

  protected readonly grupos = computed<readonly GrupoEnPantalla[]>(() => {
    const marcados = this.marcados();
    const regla = this.regla();
    const editable = this.editable();
    const filtro = { texto: this.texto(), soloMarcados: this.soloMarcados() };
    return filtrarCatalogo(this.catalogo(), marcados, filtro).map(({ grupo, visibles }) => {
      const cuantos = grupo.permisos.filter((p) => marcados.has(p.codigo)).length;
      return {
        grupo,
        marca: marcaDelGrupo(grupo, marcados),
        marcados: cuantos,
        contador: textoMarcados(cuantos, grupo.permisos.length),
        cambiable: editable && grupo.permisos.some((p) => sePuedeCambiar(p.codigo, regla)),
        permisos: visibles.map((p) => ({
          codigo: p.codigo,
          descripcion: p.descripcion,
          marcado: marcados.has(p.codigo),
          cambiable: editable && sePuedeCambiar(p.codigo, regla),
          cambio: this.mostrarCambios()
            ? cambioDePermiso(p.codigo, marcados, regla.originales)
            : null,
        })),
      };
    });
  });

  protected buscar(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }

  protected alternar(codigo: string): void {
    if (!this.editable()) return;
    this.marcados.set(alternarPermiso(codigo, this.marcados(), this.regla()));
  }

  protected alternarGrupo(grupo: GrupoPermisos): void {
    if (!this.editable()) return;
    this.marcados.set(alternarGrupo(grupo, this.marcados(), this.regla()));
  }
}
