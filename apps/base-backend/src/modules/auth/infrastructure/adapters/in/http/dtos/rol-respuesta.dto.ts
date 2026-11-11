import { ApiProperty } from '@nestjs/swagger';
import { HuellaRespuestaDto } from './huella-respuesta.dto.js';

/** Lo común de la lista y la ficha (solo para Swagger). */
class RolBaseRespuestaDto {
  @ApiProperty({ example: '0190a4f2-1c2b-7000-8000-000000000201' })
  id: string;

  @ApiProperty({ example: 'Caja' })
  nombre: string;

  @ApiProperty({ example: 'Cobra y emite recibos', nullable: true, type: String })
  descripcion: string | null;

  @ApiProperty({
    description: 'El rol Administrador: tiene todos los permisos y no se cambia',
    example: false,
  })
  esAdministrador: boolean;

  @ApiProperty({ description: 'Un rol desactivado no da permisos', example: true })
  activo: boolean;

  @ApiProperty({ description: 'Usuarios activos que lo tienen', example: 3 })
  cantidadUsuarios: number;
}

/** Una fila de `GET /roles`. */
export class RolResumenRespuestaDto extends RolBaseRespuestaDto {
  @ApiProperty({
    description: 'Permisos que da (el Administrador, todos los del catálogo)',
    example: 5,
  })
  cantidadPermisos: number;
}

/** La ficha de un rol (`GET /roles/:id` y lo que responden los cambios). */
export class RolRespuestaDto extends RolBaseRespuestaDto {
  @ApiProperty({
    description: 'Sus permisos, por código (el Administrador, todos los del catálogo)',
    example: ['auth.rol.ver', 'auth.usuario.ver'],
    type: [String],
  })
  permisos: string[];

  @ApiProperty({
    description: 'Cuándo se creó y quién, de la bitácora de la empresa; `null` si no consta',
    type: HuellaRespuestaDto,
    nullable: true,
  })
  creado: HuellaRespuestaDto | null;

  @ApiProperty({
    description:
      'Su último cambio después de crearlo (datos, permisos, activo), de la bitácora; `null` si no hubo',
    type: HuellaRespuestaDto,
    nullable: true,
  })
  modificado: HuellaRespuestaDto | null;
}
