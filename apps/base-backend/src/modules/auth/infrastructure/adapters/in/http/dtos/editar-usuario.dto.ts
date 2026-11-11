import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * `PATCH /usuarios/:id`. Sin el campo, queda igual; el nombre es obligatorio, así que `null` no
 * lo quita (400). Las reglas del nombre (largo, espacios) las dice `NombreCompleto`; aquí, solo
 * el tipo y un tope para no procesar megas.
 */
export class EditarUsuarioDto {
  @ApiPropertyOptional({
    description: 'Nombre completo nuevo, de 1 a 150 caracteres',
    example: 'Ana María Pérez',
  })
  @ValidateIf((_dto: EditarUsuarioDto, valor: unknown) => valor !== undefined)
  @MaxLength(1000, { message: 'El nombre completo es demasiado largo' })
  @IsString({ message: 'El nombre completo es obligatorio y debe ser texto' })
  nombreCompleto?: string;
}
