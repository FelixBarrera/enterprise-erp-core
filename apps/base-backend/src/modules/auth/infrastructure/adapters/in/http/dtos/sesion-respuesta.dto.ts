import { ApiProperty } from '@nestjs/swagger';

export class UsuarioDeSesionDto {
  @ApiProperty({ description: 'Id del usuario', example: '0190a4f2-1c2b-7000-8000-000000000101' })
  id: string;

  @ApiProperty({ description: 'Nombre de usuario (en minúsculas)', example: 'ana.perez' })
  nombreUsuario: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Ana Pérez' })
  nombreCompleto: string;

  @ApiProperty({
    description: 'Tiene una contraseña temporal: lo primero es cambiarla (AUTH-D14)',
    example: false,
  })
  debeCambiarContrasena: boolean;
}

export class EmpresaDeSesionDto {
  @ApiProperty({ description: 'Id de la empresa', example: '0190a4f2-1c2b-7000-8000-000000000001' })
  id: string;

  @ApiProperty({ description: 'Nombre de la empresa', example: 'Comercial del Sur' })
  nombre: string;
}

/** `GET /auth/sesion` (solo para Swagger). */
export class SesionRespuestaDto {
  @ApiProperty({ type: UsuarioDeSesionDto })
  usuario: UsuarioDeSesionDto;

  @ApiProperty({ type: EmpresaDeSesionDto, description: 'La empresa en la que está trabajando' })
  empresaActiva: EmpresaDeSesionDto;

  @ApiProperty({
    type: [EmpresaDeSesionDto],
    description: 'Todas en las que puede trabajar, por nombre (el selector, si hay más de una)',
  })
  empresas: EmpresaDeSesionDto[];

  @ApiProperty({
    description: 'Tiene el rol Administrador de la empresa activa (todos sus permisos)',
    example: true,
  })
  esAdministrador: boolean;

  @ApiProperty({
    type: [String],
    description:
      'Sus permisos vigentes en la empresa activa (`modulo.recurso.accion`), por código: los ' +
      'de sus roles activos; el Administrador, todos',
    example: ['auth.rol.ver', 'auth.usuario.ver'],
  })
  permisos: string[];

  @ApiProperty({
    description: 'Zona horaria del negocio: la pantalla muestra las fechas en esta zona',
    example: 'America/Guayaquil',
  })
  zonaNegocio: string;

  @ApiProperty({
    description: 'Hasta cuándo dura la sesión como mucho (después hay que volver a entrar)',
    example: '2026-07-15T18:00:00.000Z',
  })
  sesionVenceEn: Date;
}
