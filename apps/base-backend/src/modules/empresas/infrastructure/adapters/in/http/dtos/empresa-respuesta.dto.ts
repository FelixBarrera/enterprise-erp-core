import { ApiProperty } from '@nestjs/swagger';

/** `GET` y `PATCH /empresa` (solo para Swagger). */
export class EmpresaRespuestaDto {
  @ApiProperty({ description: 'Id de la empresa', example: '0190a4f2-1c2b-7000-8000-000000000001' })
  id: string;

  @ApiProperty({ description: 'Nombre de la empresa', example: 'Comercial del Sur' })
  nombre: string;
}
