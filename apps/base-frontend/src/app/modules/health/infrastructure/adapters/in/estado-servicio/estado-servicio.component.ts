import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { CONSULTAR_SALUD_PORT } from '../../../../application/ports/in/consultar-salud.port';
import type { ResumenSalud } from '../../../../domain/estado-salud';

/** Muestra si el sistema responde. Sin lógica: la decide el dominio. */
@Component({
  selector: 'app-estado-servicio',
  templateUrl: './estado-servicio.component.html',
  styleUrl: './estado-servicio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoServicioComponent implements OnInit {
  private readonly consultarSalud = inject(CONSULTAR_SALUD_PORT);

  protected readonly cargando = signal(true);
  protected readonly resumen = signal<ResumenSalud | null>(null);

  ngOnInit(): void {
    void this.consultar();
  }

  private async consultar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.resumen.set(await this.consultarSalud.execute());
    } finally {
      this.cargando.set(false);
    }
  }
}
