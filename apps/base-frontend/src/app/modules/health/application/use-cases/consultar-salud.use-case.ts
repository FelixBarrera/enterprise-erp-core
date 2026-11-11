import { inject, Injectable } from '@angular/core';
import { resumirSalud, type ResumenSalud } from '../../domain/estado-salud';
import type { ConsultarSaludPort } from '../ports/in/consultar-salud.port';
import { VERIFICADOR_SALUD_PORT } from '../ports/out/verificador-salud.port';

@Injectable()
export class ConsultarSaludUseCase implements ConsultarSaludPort {
  private readonly verificador = inject(VERIFICADOR_SALUD_PORT);

  async execute(): Promise<ResumenSalud> {
    return resumirSalud(await this.verificador.consultar());
  }
}
