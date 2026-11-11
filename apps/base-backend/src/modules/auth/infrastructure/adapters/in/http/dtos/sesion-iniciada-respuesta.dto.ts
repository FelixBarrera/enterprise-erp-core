import { ApiProperty } from '@nestjs/swagger';

/**
 * Lo que devuelven el login y el refresh en `data` (solo para Swagger). El refresh token **no**
 * viene aquí: va en la cookie `httpOnly` `token_refresco`.
 */
export class SesionIniciadaRespuestaDto {
  @ApiProperty({
    description:
      'Access token (JWT). Se manda en cada petición como `Authorization: Bearer <token>`; ' +
      'la pantalla lo guarda solo en memoria',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
  })
  tokenAcceso: string;

  @ApiProperty({ description: 'Segundos hasta que vence el access token', example: 900 })
  expiraEnSegundos: number;

  @ApiProperty({
    description: 'Si tiene una contraseña temporal: lo primero es cambiarla',
    example: false,
  })
  debeCambiarContrasena: boolean;
}
