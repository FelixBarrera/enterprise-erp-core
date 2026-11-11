import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  PAGINA_MAXIMA,
  TAMANO_PAGINA_MAXIMO,
  TAMANO_PAGINA_POR_DEFECTO,
  type PedidoPagina,
} from '../../application/pagina.js';

/**
 * `?pagina=2&tamano=50` de un listado. El DTO del listado la extiende y suma sus filtros:
 * `class ListarUsuariosQueryDto extends PaginacionQueryDto { … }`. Sin los parámetros: la
 * primera página de 20.
 */
export class PaginacionQueryDto implements PedidoPagina {
  @ApiPropertyOptional({
    description: 'Número de página, desde 1',
    minimum: 1,
    maximum: PAGINA_MAXIMA,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Max(PAGINA_MAXIMA, { message: `La página no puede pasar de ${PAGINA_MAXIMA}` })
  @Min(1, { message: 'La página empieza en 1' })
  @IsInt({ message: 'La página debe ser un número entero' })
  @Type(() => Number)
  pagina: number = 1;

  @ApiPropertyOptional({
    description: `Elementos por página, de 1 a ${TAMANO_PAGINA_MAXIMO}`,
    minimum: 1,
    maximum: TAMANO_PAGINA_MAXIMO,
    default: TAMANO_PAGINA_POR_DEFECTO,
    example: TAMANO_PAGINA_POR_DEFECTO,
  })
  @IsOptional()
  @Max(TAMANO_PAGINA_MAXIMO, {
    message: `El tamaño de la página no puede pasar de ${TAMANO_PAGINA_MAXIMO}`,
  })
  @Min(1, { message: 'El tamaño de la página debe ser al menos 1' })
  @IsInt({ message: 'El tamaño de la página debe ser un número entero' })
  @Type(() => Number)
  tamano: number = TAMANO_PAGINA_POR_DEFECTO;
}

/** Solo el pedido de página, sin los filtros del DTO que la extiende. */
export function pedidoPagina(dto: PaginacionQueryDto): PedidoPagina {
  return { pagina: dto.pagina, tamano: dto.tamano };
}
