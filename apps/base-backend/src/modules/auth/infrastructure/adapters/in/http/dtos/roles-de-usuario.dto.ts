import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Crear un usuario y fijar sus roles de un usuario (`/usuarios`). Las reglas del nombre de
 * usuario y del nombre completo las dicen `NombreUsuario` y `NombreCompleto`; aquí, solo el tipo
 * y un tope para no procesar megas.
 */

/** Más que los roles de cualquier empresa: solo para no recibir listas enormes. */
export const MAXIMO_ROLES = 100;

const EJEMPLO_ROLES = ['0190a4f2-1c2b-7000-8000-000000000201'];
const DESCRIPCION_ROLES =
  'Ids de roles de la empresa activa (`GET /roles`). Quien no es administrador solo da roles ' +
  'cuyos permisos tiene; el rol Administrador lo da solo un administrador';

/** `POST /usuarios`. */
export class CrearUsuarioDto {
  @ApiProperty({
    description:
      'Con lo que entra: de 3 a 50 letras minúsculas sin tildes, dígitos, `.`, `_` o `-`. Único ' +
      'para siempre, aunque se desactive',
    example: 'ana.perez',
  })
  @MaxLength(1000, { message: 'El nombre de usuario es demasiado largo' })
  @IsString({ message: 'El nombre de usuario es obligatorio y debe ser texto' })
  nombreUsuario: string;

  @ApiProperty({ description: 'Nombre completo, de 1 a 150 caracteres', example: 'Ana Pérez' })
  @MaxLength(1000, { message: 'El nombre completo es demasiado largo' })
  @IsString({ message: 'El nombre completo es obligatorio y debe ser texto' })
  nombreCompleto: string;

  @ApiProperty({ description: DESCRIPCION_ROLES, example: EJEMPLO_ROLES, type: [String] })
  @ArrayMaxSize(MAXIMO_ROLES, { message: `No se pueden mandar más de ${MAXIMO_ROLES} roles` })
  @ArrayMinSize(1, { message: 'Debe elegir al menos un rol' })
  @IsUUID('all', { each: true, message: 'Cada rol debe ser un id válido' })
  @IsArray({ message: 'Los roles son obligatorios y deben ser una lista' })
  roles: string[];
}

/** `PUT /usuarios/:id/roles`: la lista completa con la que queda (al menos uno). */
export class FijarRolesUsuarioDto {
  @ApiProperty({
    description: `Todos los roles que tendrá en la empresa activa. ${DESCRIPCION_ROLES}. Sin ninguno: «Quitar acceso»`,
    example: EJEMPLO_ROLES,
    type: [String],
  })
  @ArrayMaxSize(MAXIMO_ROLES, { message: `No se pueden mandar más de ${MAXIMO_ROLES} roles` })
  @ArrayMinSize(1, { message: 'Para quitarle todos los roles use Quitar acceso' })
  @IsUUID('all', { each: true, message: 'Cada rol debe ser un id válido' })
  @IsArray({ message: 'Los roles son obligatorios y deben ser una lista' })
  roles: string[];
}
