import { ApiProperty } from '@nestjs/swagger';

export class PermisoRespuestaDto {
  @ApiProperty({
    description: 'Código del permiso (`modulo.recurso.accion`): el que se asigna a un rol',
    example: 'auth.usuario.ver',
  })
  codigo: string;

  @ApiProperty({ description: 'Lo que permite, para la casilla', example: 'Ver usuarios' })
  descripcion: string;
}

/** `GET /permisos` (solo para Swagger): un grupo por módulo. */
export class GrupoPermisosRespuestaDto {
  @ApiProperty({ description: 'Código del módulo', example: 'auth' })
  modulo: string;

  @ApiProperty({ description: 'Título del grupo en la pantalla', example: 'Usuarios y roles' })
  nombre: string;

  @ApiProperty({
    type: [PermisoRespuestaDto],
    description: 'Sus permisos, en el orden en que los declara el módulo',
  })
  permisos: PermisoRespuestaDto[];
}
