import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * `POST /auth/cambiar-contrasena`. Aquí solo se revisa que venga texto y que no sea enorme (un
 * tope para no calcular Argon2 sobre megas de texto): las reglas de la nueva las dice
 * `Contrasena`, con un mensaje por motivo.
 */
export class CambiarContrasenaDto {
  @ApiProperty({ description: 'La contraseña actual (o la temporal)', format: 'password' })
  @MaxLength(1000, { message: 'La contraseña actual es demasiado larga' })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  @IsString({ message: 'La contraseña actual es obligatoria y debe ser texto' })
  contrasenaActual: string;

  @ApiProperty({
    description:
      'La nueva: de 8 a 128 caracteres; no puede ser común, trivial, igual a la actual ni ' +
      'contener su nombre de usuario o el de sus empresas',
    format: 'password',
    example: 'Girasol-Martes-83',
  })
  @MaxLength(1000, { message: 'La contraseña nueva es demasiado larga' })
  @IsNotEmpty({ message: 'La contraseña nueva es obligatoria' })
  @IsString({ message: 'La contraseña nueva es obligatoria y debe ser texto' })
  contrasenaNueva: string;
}
