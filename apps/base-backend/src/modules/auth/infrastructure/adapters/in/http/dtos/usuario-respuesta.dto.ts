import { ApiProperty } from '@nestjs/swagger';
import { HuellaRespuestaDto } from './huella-respuesta.dto.js';

/** Un rol del usuario en la empresa activa (solo para Swagger). */
export class RolDeUsuarioRespuestaDto {
  @ApiProperty({ example: '0190a4f2-1c2b-7000-8000-000000000201' })
  id: string;

  @ApiProperty({ example: 'Caja' })
  nombre: string;

  @ApiProperty({ example: false })
  esAdministrador: boolean;

  @ApiProperty({ description: 'Un rol desactivado no da permisos', example: true })
  activo: boolean;
}

/** Un rol de `GET /usuarios/roles-asignables` (solo para Swagger). */
export class RolAsignableRespuestaDto {
  @ApiProperty({ example: '0190a4f2-1c2b-7000-8000-000000000201' })
  id: string;

  @ApiProperty({ example: 'Caja' })
  nombre: string;

  @ApiProperty({ example: 'Emite facturas y cobra', nullable: true, type: String })
  descripcion: string | null;

  @ApiProperty({ example: false })
  esAdministrador: boolean;

  @ApiProperty({
    description:
      'Quien consulta lo puede dar: un administrador, todos; quien no lo es, los que tienen solo ' +
      'permisos suyos y nunca el Administrador (AUTH-D11). La API rechaza igual los demás',
    example: true,
  })
  sePuedeDar: boolean;
}

/** Una sesión abierta del usuario en la empresa activa (solo para Swagger). */
export class SesionAbiertaRespuestaDto {
  @ApiProperty({ example: '0190a4f2-1c2b-7000-8000-000000000301' })
  id: string;

  @ApiProperty({ example: '2026-07-15T13:00:00.000Z' })
  iniciadaEn: string;

  @ApiProperty({ example: '2026-07-15T15:45:00.000Z' })
  ultimoUsoEn: string;

  @ApiProperty({ example: '10.0.0.7', nullable: true, type: String })
  ip: string | null;

  @ApiProperty({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)…',
    nullable: true,
    type: String,
  })
  navegador: string | null;
}

/** Una fila de `GET /usuarios`. */
export class UsuarioResumenRespuestaDto {
  @ApiProperty({ example: '0190a4f2-1c2b-7000-8000-000000000101' })
  id: string;

  @ApiProperty({ description: 'Con lo que entra; no cambia', example: 'ana.perez' })
  nombreUsuario: string;

  @ApiProperty({ example: 'Ana Pérez' })
  nombreCompleto: string;

  @ApiProperty({ description: 'Un usuario desactivado no entra en ninguna empresa', example: true })
  activo: boolean;

  @ApiProperty({
    description: 'Bloqueado por intentos fallidos hasta ese momento; `null` si no lo está',
    example: null,
    nullable: true,
    type: String,
  })
  bloqueadoHasta: string | null;

  @ApiProperty({ example: '2026-07-15T13:00:00.000Z', nullable: true, type: String })
  ultimoIngresoEn: string | null;

  @ApiProperty({
    description: 'Tiene una contraseña temporal que todavía no cambió',
    example: false,
  })
  debeCambiarContrasena: boolean;

  @ApiProperty({ description: 'Sus roles en la empresa activa', type: [RolDeUsuarioRespuestaDto] })
  roles: RolDeUsuarioRespuestaDto[];
}

/** La ficha de un usuario (`GET /usuarios/:id` y lo que responden los cambios). */
export class UsuarioRespuestaDto extends UsuarioResumenRespuestaDto {
  @ApiProperty({
    description:
      'Tiene roles en otra empresa (sin decir cuál): lo que es de la persona solo lo cambia ' +
      'quien lo administra en todas',
    example: false,
  })
  trabajaEnOtrasEmpresas: boolean;

  @ApiProperty({
    description: 'Sus sesiones abiertas en la empresa activa, la usada más hace poco primero',
    type: [SesionAbiertaRespuestaDto],
  })
  sesiones: SesionAbiertaRespuestaDto[];

  @ApiProperty({
    description:
      'Cuándo entró a la empresa activa (lo crearon o le dieron acceso) y quién, de su bitácora; `null` si no consta',
    type: HuellaRespuestaDto,
    nullable: true,
  })
  creado: HuellaRespuestaDto | null;

  @ApiProperty({
    description:
      'El último cambio hecho por una persona en esta empresa después de eso (no cuentan los ingresos); `null` si no hubo',
    type: HuellaRespuestaDto,
    nullable: true,
  })
  modificado: HuellaRespuestaDto | null;
}

/**
 * `POST /usuarios` y `POST /usuarios/:id/contrasena-temporal`: la ficha y la contraseña temporal,
 * que se muestra esta sola vez.
 */
export class UsuarioCreadoRespuestaDto {
  @ApiProperty({ type: UsuarioRespuestaDto })
  usuario: UsuarioRespuestaDto;

  @ApiProperty({
    description:
      'Contraseña temporal generada por el sistema (12 caracteres). Se muestra **una sola vez**: ' +
      'la API no la guarda ni la vuelve a dar. Al entrar, el usuario debe cambiarla',
    example: 'k7Rm3xTq9vWb',
  })
  contrasenaTemporal: string;
}

/** `POST /usuarios/:id/quitar-acceso`. */
export class AccesoQuitadoRespuestaDto {
  @ApiProperty({ example: '0190a4f2-1c2b-7000-8000-000000000101' })
  id: string;

  @ApiProperty({ description: 'Sus sesiones en la empresa activa que se cerraron', example: 1 })
  sesionesCerradas: number;
}

/** `POST /usuarios/:id/cerrar-sesiones`. */
export class SesionesCerradasRespuestaDto {
  @ApiProperty({ example: '0190a4f2-1c2b-7000-8000-000000000101' })
  id: string;

  @ApiProperty({
    description:
      'Sus sesiones que se cerraron, en todas sus empresas (sobre uno mismo, menos la actual)',
    example: 2,
  })
  sesionesCerradas: number;
}
