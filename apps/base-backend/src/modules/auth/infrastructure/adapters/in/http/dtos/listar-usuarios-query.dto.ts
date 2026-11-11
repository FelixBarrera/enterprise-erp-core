import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginacionQueryDto } from '../../../../../../../shared/infrastructure/http/paginacion-query.dto.js';
import { aBooleano } from './listar-roles-query.dto.js';

/** `GET /usuarios`. */
export class ListarUsuariosQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    description:
      'Parte del nombre completo o del nombre de usuario, sin importar mayúsculas ni tildes',
    example: 'perez',
  })
  @IsOptional()
  @MaxLength(150, { message: 'El texto a buscar no puede pasar de 150 caracteres' })
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

  @ApiPropertyOptional({
    description: 'Solo los que tienen ese rol (de `GET /roles`)',
    example: '0190a4f2-1c2b-7000-8000-000000000201',
  })
  @IsOptional()
  @IsUUID('all', { message: 'El rol a filtrar no es válido' })
  rolId?: string;
}
