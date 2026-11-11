import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginacionQueryDto } from '../../../../../../../shared/infrastructure/http/paginacion-query.dto.js';
import { RANGO_MAXIMO_DIAS } from '../../../../../domain/rango-consulta.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Una acción completa (`auth.usuario.crear`) o un grupo (`auth.usuario`, `auth`). */
const ACCION_O_GRUPO = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){0,2}$/;

export const MENSAJES_CONSULTA = {
  desde: 'La fecha desde es obligatoria y debe tener el formato aaaa-mm-dd',
  hasta: 'La fecha hasta es obligatoria y debe tener el formato aaaa-mm-dd',
  usuario: 'El id del usuario no es válido',
  accion: 'La acción debe tener la forma modulo, modulo.recurso o modulo.recurso.accion',
  accionLarga: 'La acción no puede pasar de 100 caracteres',
  entidad: 'Para buscar un registro hace falta su tipo (entidad), como texto',
  entidadVacia: 'El tipo de registro no puede ir vacío',
  entidadLarga: 'El tipo de registro no puede pasar de 60 caracteres',
  entidadId: 'El id del registro no es válido',
} as const;

/**
 * La historia de un registro (`entidadId`, que pide `entidad`): ahí las fechas son opcionales y
 * sin tope de días (6.12c0b). En cualquier otra búsqueda, obligatorias.
 */
const fechaSeRevisa = (campo: 'desde' | 'hasta') => (dto: ListarEventosQueryDto) =>
  dto[campo] !== undefined || dto.entidadId === undefined;

/** `GET /auditoria/eventos`. */
export class ListarEventosQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    description:
      `Desde este día (incluido), en la zona del negocio. Obligatoria, hasta ${RANGO_MAXIMO_DIAS} ` +
      'días con hasta; en la historia de un registro (`entidadId`), opcional y sin tope',
    example: '2026-11-01',
  })
  @ValidateIf(fechaSeRevisa('desde'))
  @Matches(FECHA, { message: MENSAJES_CONSULTA.desde })
  @IsString({ message: MENSAJES_CONSULTA.desde })
  desde?: string;

  @ApiPropertyOptional({
    description:
      'Hasta este día (incluido), en la zona del negocio. Obligatoria, salvo en la historia de ' +
      'un registro',
    example: '2026-11-06',
  })
  @ValidateIf(fechaSeRevisa('hasta'))
  @Matches(FECHA, { message: MENSAJES_CONSULTA.hasta })
  @IsString({ message: MENSAJES_CONSULTA.hasta })
  hasta?: string;

  @ApiPropertyOptional({
    description: 'Solo lo que hizo esta persona',
    example: '0190a4f2-1c2b-7000-8000-000000000101',
  })
  @IsOptional()
  @IsUUID('all', { message: MENSAJES_CONSULTA.usuario })
  usuarioId?: string;

  @ApiPropertyOptional({
    description:
      'Una acción (`auth.usuario.crear`) o todo un grupo (`auth.usuario` trae las de usuarios, ' +
      '`auth` todas las del módulo)',
    example: 'auth.usuario',
  })
  @IsOptional()
  @Matches(ACCION_O_GRUPO, { message: MENSAJES_CONSULTA.accion })
  @MaxLength(100, { message: MENSAJES_CONSULTA.accionLarga })
  @IsString({ message: MENSAJES_CONSULTA.accion })
  accion?: string;

  @ApiPropertyOptional({
    description: 'Tipo de registro (`usuario`, `rol`…); obligatorio si va `entidadId`',
    example: 'usuario',
  })
  @ValidateIf(
    (dto: ListarEventosQueryDto) => dto.entidad !== undefined || dto.entidadId !== undefined,
  )
  @MaxLength(60, { message: MENSAJES_CONSULTA.entidadLarga })
  @IsNotEmpty({ message: MENSAJES_CONSULTA.entidadVacia })
  @IsString({ message: MENSAJES_CONSULTA.entidad })
  entidad?: string;

  @ApiPropertyOptional({
    description: 'Con `entidad`: la historia de ese registro',
    example: '0190a4f2-1c2b-7000-8000-000000000101',
  })
  @IsOptional()
  @IsUUID('all', { message: MENSAJES_CONSULTA.entidadId })
  entidadId?: string;
}
