import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  filasDeRoles,
  type ReglaRolesUsuario,
  type RolAsignable,
  type RolDeUsuario,
} from '../../../../domain/usuario';

/**
 * La pestaña «Roles» de un usuario (la ficha y el alta): una casilla por rol con su
 * descripción y, a la derecha, «Se agrega», «Se quita» o por qué no se puede (AUTH-D11). Los
 * desactivados que ya tiene van al final, en gris. `[(marcados)]` de ida y vuelta. En el alta,
 * `[mostrarCambios]="false"`: todo es nuevo, sin «Se agrega» en cada fila.
 *
 * Uso: `<app-editor-roles-usuario [asignables]="…" [actuales]="usuario.roles"
 * [(marcados)]="marcados" [regla]="regla()" titulo="Roles en …" />`.
 */
@Component({
  selector: 'app-editor-roles-usuario',
  imports: [MatCheckboxModule],
  template: `
    <section class="tarjeta editor-roles" [attr.aria-labelledby]="'roles-usuario-titulo'">
      <div class="editor-roles__cabecera">
        <h2 id="roles-usuario-titulo" class="editor-roles__titulo">{{ titulo() }}</h2>
        <span class="editor-roles__total numero" aria-live="polite">
          <strong>{{ marcados().size }}</strong> de {{ filas().length }}
          {{ filas().length === 1 ? 'marcado' : 'marcados' }}
        </span>
      </div>
      <ul class="editor-roles__lista">
        @for (f of filas(); track f.id) {
          <li class="editor-roles__rol" [class.editor-roles__rol--desactivado]="f.desactivado">
            <mat-checkbox
              [checked]="f.marcado"
              [disabled]="!f.cambiable"
              [aria-describedby]="'rol-usuario-' + f.id"
              (change)="alternar(f.id)"
            >
              <span class="editor-roles__nombre">{{ f.nombre }}</span>
            </mat-checkbox>
            <span class="editor-roles__descripcion" [id]="'rol-usuario-' + f.id">
              {{ f.descripcion ?? '' }}
              @if (f.nota && !f.esCambio) {
                <span class="oculto-visual">. {{ f.nota }}</span>
              }
            </span>
            @if (f.nota && (mostrarCambios() || !f.esCambio)) {
              <span
                class="editor-roles__nota"
                [class.editor-roles__nota--cambio]="f.esCambio"
                [attr.aria-hidden]="f.esCambio ? null : 'true'"
                >{{ f.nota }}</span
              >
            }
          </li>
        } @empty {
          <li class="editor-roles__vacio">No hay roles activos en esta empresa.</li>
        }
      </ul>
    </section>
  `,
  styleUrl: './editor-roles-usuario.component.scss',
  host: { '[class.editor-roles--solo-lectura]': '!regla().editable' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorRolesUsuarioComponent {
  /** `GET /usuarios/roles-asignables`. */
  readonly asignables = input.required<readonly RolAsignable[]>();
  /** Los que tiene guardados (en el alta, ninguno). */
  readonly actuales = input.required<readonly RolDeUsuario[]>();
  readonly marcados = model.required<ReadonlySet<string>>();
  readonly regla = input.required<ReglaRolesUsuario>();
  readonly titulo = input('Roles');
  readonly mostrarCambios = input(true);

  protected readonly filas = computed(() =>
    filasDeRoles(this.asignables(), this.actuales(), this.marcados(), this.regla()),
  );

  protected alternar(id: string): void {
    const marcados = new Set(this.marcados());
    if (marcados.has(id)) marcados.delete(id);
    else marcados.add(id);
    this.marcados.set(marcados);
  }
}
