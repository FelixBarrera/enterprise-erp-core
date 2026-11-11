import { ApiProperty } from '@nestjs/swagger';

/** Una fila de `GET /auditoria/eventos` (solo para Swagger). */
export class EventoResumenRespuestaDto {
  @ApiProperty({ example: '0190a4f2-1c2b-7000-8000-000000000901' })
  id: string;

  @ApiProperty({
    description: 'Cuándo pasó (instante en UTC; la pantalla lo muestra en la zona del negocio)',
    example: '2026-11-06T16:30:00.000Z',
  })
  ocurridoEn: string;

  @ApiProperty({
    description: 'Quién (null: un proceso del sistema)',
    example: '0190a4f2-1c2b-7000-8000-000000000101',
    nullable: true,
    type: String,
  })
  usuarioId: string | null;

  @ApiProperty({
    description: 'Cómo se llamaba quien lo hizo en ese momento',
    example: 'ana',
    nullable: true,
    type: String,
  })
  nombreUsuario: string | null;

  @ApiProperty({
    description: 'Qué hizo (`modulo.recurso.accion`; el texto en español lo pone la pantalla)',
    example: 'auth.usuario.crear',
  })
  accion: string;

  @ApiProperty({
    description: 'Sobre qué tipo de registro',
    example: 'usuario',
    nullable: true,
    type: String,
  })
  entidad: string | null;

  @ApiProperty({
    description: 'Sobre cuál',
    example: '0190a4f2-1c2b-7000-8000-000000000102',
    nullable: true,
    type: String,
  })
  entidadId: string | null;

  @ApiProperty({
    description:
      'Cómo se llamaba en ese momento (de un usuario, su nombre de usuario; de una sesión, su ' +
      'usuario). null en los eventos anteriores al 6.12c0b o sin registro',
    example: 'jorge.vera',
    nullable: true,
    type: String,
  })
  entidadNombre: string | null;
}

/** `GET /auditoria/eventos/:id`. */
export class EventoRespuestaDto extends EventoResumenRespuestaDto {
  @ApiProperty({
    description: 'Los campos que cambiaron, como estaban (null: se creó o no hubo cambios)',
    example: { nombreCompleto: 'Ana Ruiz' },
    nullable: true,
    type: Object,
  })
  antes: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Los mismos campos, como quedaron. Lo sensible sale como [OCULTO]',
    example: { nombreCompleto: 'Ana Ruiz Vera' },
    nullable: true,
    type: Object,
  })
  despues: Record<string, unknown> | null;

  @ApiProperty({ example: '192.0.2.10', nullable: true, type: String })
  ip: string | null;

  @ApiProperty({ example: 'Mozilla/5.0 (X11; Linux x86_64)', nullable: true, type: String })
  navegador: string | null;

  @ApiProperty({
    description: 'Para cruzarlo con los logs del servidor',
    example: '6f1c2a9e-3b7d-4f5a-9c2e-1d8b7a6e5f40',
    nullable: true,
    type: String,
  })
  requestId: string | null;
}

/** Una persona de `GET /auditoria/usuarios` (solo para Swagger). */
export class UsuarioDeBitacoraRespuestaDto {
  @ApiProperty({
    description: 'Para filtrar la bitácora (`usuarioId`)',
    example: '0190a4f2-1c2b-7000-8000-000000000101',
  })
  usuarioId: string;

  @ApiProperty({ example: 'ana' })
  nombreUsuario: string;
}
