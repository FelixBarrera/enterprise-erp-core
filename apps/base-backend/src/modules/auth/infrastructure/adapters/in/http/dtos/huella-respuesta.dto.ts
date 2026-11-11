import { ApiProperty } from '@nestjs/swagger';

/** Cuándo y quién, para el pie de una ficha (solo para Swagger). */
export class HuellaRespuestaDto {
  @ApiProperty({ example: '2026-07-15T16:00:00.000Z' })
  en: string;

  @ApiProperty({
    description: 'Nombre de usuario de quien lo hizo, como se llamaba entonces; `null`: el sistema',
    example: 'ana.perez',
    nullable: true,
    type: String,
  })
  por: string | null;
}
