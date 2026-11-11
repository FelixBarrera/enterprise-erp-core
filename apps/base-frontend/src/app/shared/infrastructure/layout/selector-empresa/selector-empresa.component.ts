import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { iniciales } from '../../../domain/iniciales';
import { IconoComponent } from '../icono/icono.component';
import { USUARIO_CABECERA } from '../usuario-cabecera';

export interface DatosSelectorEmpresa {
  /** En el celular sube desde abajo, con su asa. */
  enCelular: boolean;
  idTitulo: string;
  idTexto: string;
}

/** La ventana de `SelectorEmpresaService`. No se usa directo. */
@Component({
  selector: 'app-selector-empresa',
  imports: [IconoComponent],
  templateUrl: './selector-empresa.component.html',
  styleUrl: './selector-empresa.component.scss',
  host: { '[class.selector--celular]': 'datos.enCelular' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorEmpresaComponent {
  protected readonly datos = inject<DatosSelectorEmpresa>(DIALOG_DATA);
  protected readonly usuario = inject(USUARIO_CABECERA);
  private readonly ref = inject<DialogRef<void>>(DialogRef);

  /** La empresa a la que se está pasando (mientras, nada más responde). */
  protected readonly cambiandoA = signal<string | null>(null);
  protected readonly iniciales = iniciales;

  /** La activa solo cierra. Si el cambio falla, el aviso global lo dice y se puede elegir otra. */
  protected async elegir(empresaId: string): Promise<void> {
    if (this.cambiandoA() !== null) return;
    if (empresaId === this.usuario.empresaActivaId()) {
      this.cerrar();
      return;
    }
    this.cambiandoA.set(empresaId);
    this.ref.disableClose = true;
    try {
      await this.usuario.cambiarEmpresa(empresaId); // recarga la página
    } catch {
      this.cambiandoA.set(null);
      this.ref.disableClose = false;
    }
  }

  protected cerrar(): void {
    if (this.cambiandoA() === null) this.ref.close();
  }
}
