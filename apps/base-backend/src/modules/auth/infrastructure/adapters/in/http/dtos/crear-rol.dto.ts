import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * Las reglas del nombre y la descripción (largo, espacios) las dicen `NombreRol` y
 * `descripcionRol()`; aquí, solo el tipo y un tope para no procesar megas.
 */

/** Más que todo el catálogo: solo para no recibir listas enormes. */
export const MAXIMO_PERMISOS = 500;

export const EJEMPLO_PERMISOS = ['auth.usuario.ver', 'auth.rol.ver'];

/** `POST /roles`. */
export class CrearRolDto {
  @ApiProperty({
    description: 'Nombre, de 1 a 80 caracteres (único entre los roles activos de la empresa)',
    example: 'Caja',
  })
  @MaxLength(1000, { message: 'El nombre del rol es demasiado largo' })
  @IsString({ message: 'El nombre del rol es obligatorio y debe ser texto' })
  nombre: string;

  @ApiPropertyOptional({
    description: 'Para qué es el rol, hasta 250 caracteres. Sin ella, `null` o vacía: ninguna',
    example: 'Cobra y emite recibos',
    nullable: true,
    type: String,
  })
  @ValidateIf((_dto: CrearRolDto, valor: unknown) => valor !== undefined && valor !== null)
  @MaxLength(1000, { message: 'La descripción del rol es demasiado larga' })
  @IsString({ message: 'La descripción del rol debe ser texto' })
  descripcion?: string | null;

  @ApiPropertyOptional({
    description:
      'Sus permisos (códigos de `GET /permisos`). Quien no es administrador solo da los que tiene',
    example: EJEMPLO_PERMISOS,
    type: [String],
  })
  // Ausente: ninguno; `null` no es una lista (400).
  @ValidateIf((_dto: CrearRolDto, valor: unknown) => valor !== undefined)
  @ArrayMaxSize(MAXIMO_PERMISOS, {
    message: `No se pueden mandar más de ${MAXIMO_PERMISOS} permisos`,
  })
  @MaxLength(100, { each: true, message: 'Cada permiso es un código de hasta 100 caracteres' })
  @IsString({ each: true, message: 'Cada permiso debe ser texto' })
  @IsArray({ message: 'Los permisos deben ser una lista' })
  permisos?: string[];
}
