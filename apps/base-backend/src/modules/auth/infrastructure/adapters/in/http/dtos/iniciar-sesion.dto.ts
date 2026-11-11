import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { IniciarSesionComando } from '../../../../../application/ports/in/iniciar-sesion.port.js';

/**
 * `POST /auth/login`. Solo se revisa que venga texto y que no sea enorme: el formato del nombre
 * y las reglas de la contraseña no se dicen aquí (un login mal escrito es "Credenciales
 * inválidas", AUTH-D15). Las contraseñas válidas tienen hasta 128 caracteres; se acepta más
 * para no adelantar ninguna regla, con un tope para no calcular Argon2 sobre megas de texto.
 */
export class IniciarSesionDto implements IniciarSesionComando {
  @ApiProperty({ description: 'Nombre de usuario (sin importar mayúsculas)', example: 'ana.perez' })
  @MaxLength(100, { message: 'El nombre de usuario es demasiado largo' })
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  @IsString({ message: 'El nombre de usuario es obligatorio y debe ser texto' })
  nombreUsuario: string;

  @ApiProperty({ description: 'Contraseña', example: 'Margarita-Lunes-47', format: 'password' })
  @MaxLength(1000, { message: 'La contraseña es demasiado larga' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString({ message: 'La contraseña es obligatoria y debe ser texto' })
  contrasena: string;
}
