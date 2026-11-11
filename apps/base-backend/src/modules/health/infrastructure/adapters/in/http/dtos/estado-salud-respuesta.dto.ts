import { ApiProperty } from '@nestjs/swagger';
import type { EstadoDependencia, EstadoSalud } from '../../../../../domain/estado-salud.js';

/** Lo que devuelve `GET /api/v1/health` (solo para Swagger: describe la forma de `data`). */
export class EstadoSaludRespuestaDto implements EstadoSalud {
  @ApiProperty({ description: 'Si el servicio puede atender', example: true })
  disponible: boolean;

  @ApiProperty({
    description: 'Si la base de datos responde',
    enum: ['ok', 'falla'],
    example: 'ok',
  })
  baseDatos: EstadoDependencia;
}
