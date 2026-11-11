import { Inject, Injectable } from '@nestjs/common';
import { calcularEstadoSalud, type EstadoSalud } from '../../domain/estado-salud.js';
import type { ConsultarSaludPort } from '../ports/in/consultar-salud.port.js';
import {
  VERIFICADOR_BASE_DATOS_PORT,
  type VerificadorBaseDatosPort,
} from '../ports/out/verificador-base-datos.port.js';

@Injectable()
export class ConsultarSaludUseCase implements ConsultarSaludPort {
  constructor(
    @Inject(VERIFICADOR_BASE_DATOS_PORT) private readonly baseDatos: VerificadorBaseDatosPort,
  ) {}

  async execute(): Promise<EstadoSalud> {
    return calcularEstadoSalud(await this.baseDatos.responde());
  }
}
