import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * `PATCH /empresa`. Un campo que no viene queda igual; `null` no vale (el nombre es obligatorio).
 * Las reglas del nombre (largo, espacios) las dice `NombreEmpresa`; aquí, solo que sea texto y
 * un tope para no procesar megas.
 */
export class EditarEmpresaDto {
  @ApiPropertyOptional({
    description: 'Nombre nuevo, de 1 a 150 caracteres (único entre las empresas activas)',
    example: 'Comercial del Sur',
  })
  @ValidateIf((_dto: EditarEmpresaDto, valor: unknown) => valor !== undefined)
  @MaxLength(1000, { message: 'El nombre de la empresa es demasiado largo' })
  @IsString({ message: 'El nombre de la empresa es obligatorio y debe ser texto' })
  nombre?: string;
}
