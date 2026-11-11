import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionQueryDto } from '../../../../../../../shared/infrastructure/http/paginacion-query.dto.js';

/** `?activo=true|false` llega como texto: pasa a booleano (otro valor queda y lo rechaza `IsBoolean`). */
export const aBooleano = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

/** `GET /roles`. */
export class ListarRolesQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    description: 'Parte del nombre, sin importar mayúsculas ni tildes',
    example: 'caja',
  })
  @IsOptional()
  @MaxLength(80, { message: 'El texto a buscar no puede pasar de 80 caracteres' })
  @IsString({ message: 'El texto a buscar debe ser texto' })
  texto?: string;

  @ApiPropertyOptional({
    description: 'Solo los activos (`true`) o solo los desactivados (`false`); sin él, todos',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'El filtro activo debe ser true o false' })
  @Transform(aBooleano)
  activo?: boolean;
}
