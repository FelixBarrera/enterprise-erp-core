import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';
import { EJEMPLO_PERMISOS, MAXIMO_PERMISOS } from './crear-rol.dto.js';

/** `PUT /roles/:id/permisos`: la lista completa con la que queda (vacía: ninguno). */
export class FijarPermisosRolDto {
  @ApiProperty({
    description:
      'Todos los permisos que tendrá (códigos de `GET /permisos`). Quien no es administrador solo ' +
      'agrega los que tiene; quitar, cualquiera con el permiso',
    example: EJEMPLO_PERMISOS,
    type: [String],
  })
  @ArrayMaxSize(MAXIMO_PERMISOS, {
    message: `No se pueden mandar más de ${MAXIMO_PERMISOS} permisos`,
  })
  @MaxLength(100, { each: true, message: 'Cada permiso es un código de hasta 100 caracteres' })
  @IsString({ each: true, message: 'Cada permiso debe ser texto' })
  @IsArray({ message: 'Los permisos son obligatorios y deben ser una lista' })
  permisos: string[];
}
