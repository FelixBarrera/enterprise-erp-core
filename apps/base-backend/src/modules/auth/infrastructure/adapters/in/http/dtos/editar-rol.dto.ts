import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, ValidateIf } from 'class-validator';

/** `PATCH /roles/:id`. Un campo que no viene queda igual; `descripcion: null` la quita. */
export class EditarRolDto {
  @ApiPropertyOptional({ description: 'Nombre nuevo, de 1 a 80 caracteres', example: 'Caja' })
  @ValidateIf((_dto: EditarRolDto, valor: unknown) => valor !== undefined)
  @MaxLength(1000, { message: 'El nombre del rol es demasiado largo' })
  @IsString({ message: 'El nombre del rol es obligatorio y debe ser texto' })
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Descripción nueva, hasta 250 caracteres; `null` o vacía la quita',
    example: 'Cobra y emite recibos',
    nullable: true,
    type: String,
  })
  @ValidateIf((_dto: EditarRolDto, valor: unknown) => valor !== undefined && valor !== null)
  @MaxLength(1000, { message: 'La descripción del rol es demasiado larga' })
  @IsString({ message: 'La descripción del rol debe ser texto' })
  descripcion?: string | null;
}
