import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import { SinLimite } from '../../../../../../shared/infrastructure/limite/limite.decorators.js';
import {
  ok,
  type RespuestaApi,
} from '../../../../../../shared/infrastructure/http/respuesta-api.js';
import {
  ApiRespuestaError,
  ApiRespuestaOk,
} from '../../../../../../shared/infrastructure/http/swagger.decorators.js';
import {
  CONSULTAR_SALUD_PORT,
  type ConsultarSaludPort,
} from '../../../../application/ports/in/consultar-salud.port.js';
import type { EstadoSalud } from '../../../../domain/estado-salud.js';
import { EstadoSaludRespuestaDto } from './dtos/estado-salud-respuesta.dto.js';

@ApiTags('Estado del servicio')
@Controller('health')
export class HealthController {
  constructor(@Inject(CONSULTAR_SALUD_PORT) private readonly consultarSalud: ConsultarSaludPort) {}

  // ─── GET /api/v1/health — Estado del servicio ───
  // Para el monitoreo: 200 si todo responde, 503 si no (el monitoreo mira el código).
  @Get()
  @Publico()
  @SinLimite()
  @ApiOperation({
    summary: 'Estado del servicio',
    description:
      'Para el monitoreo. Revisa que la base de datos responda (en 2 segundos como máximo). ' +
      'No muestra versiones ni detalles internos.',
  })
  @ApiRespuestaOk(EstadoSaludRespuestaDto, 'Servicio en marcha')
  @ApiRespuestaError(503, 'El servicio no está disponible en este momento')
  async consultar(): Promise<RespuestaApi<EstadoSalud>> {
    const estado = await this.consultarSalud.execute();
    if (!estado.disponible) {
      throw new ServiceUnavailableException();
    }
    return ok(estado, 'Servicio en marcha');
  }
}
