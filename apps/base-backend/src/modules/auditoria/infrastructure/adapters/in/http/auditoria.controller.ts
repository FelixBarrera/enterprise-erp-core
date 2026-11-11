import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../../../shared/application/actor.js';
import type { Pagina } from '../../../../../../shared/application/pagina.js';
import { RequierePermiso } from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import { UsuarioActual } from '../../../../../../shared/infrastructure/http/acceso/sesion-de-peticion.js';
import { ID_PIPE } from '../../../../../../shared/infrastructure/http/id.pipe.js';
import { pedidoPagina } from '../../../../../../shared/infrastructure/http/paginacion-query.dto.js';
import {
  ok,
  type RespuestaApi,
} from '../../../../../../shared/infrastructure/http/respuesta-api.js';
import {
  ApiRespuestaError,
  ApiRespuestaOk,
  ApiRespuestaPagina,
} from '../../../../../../shared/infrastructure/http/swagger.decorators.js';
import {
  CONSULTAR_AUDITORIA_PORT,
  type ConsultarAuditoriaPort,
  type EventoResumenVista,
  type EventoVista,
  type UsuarioDeBitacoraVista,
} from '../../../../application/ports/in/consultar-auditoria.port.js';
import { MENSAJE_RANGO_INVERTIDO, MENSAJE_RANGO_LARGO } from '../../../../domain/rango-consulta.js';
import {
  EventoRespuestaDto,
  EventoResumenRespuestaDto,
  UsuarioDeBitacoraRespuestaDto,
} from './dtos/evento-respuesta.dto.js';
import { ListarEventosQueryDto, MENSAJES_CONSULTA } from './dtos/listar-eventos-query.dto.js';

/**
 * La bitácora de la empresa activa (docs/modulos/auditoria.md, sección 5). Nunca la de otra:
 * un evento de otra empresa responde 404, igual que uno que no existe. Consultarla no se
 * registra en la bitácora: cada petición ya queda en el log del servidor.
 */
@ApiTags('Bitácora')
@Controller('auditoria')
export class AuditoriaController {
  constructor(
    @Inject(CONSULTAR_AUDITORIA_PORT) private readonly consultar: ConsultarAuditoriaPort,
  ) {}

  // ─── GET /api/v1/auditoria/eventos — Bitácora ───
  @Get('eventos')
  @RequierePermiso('auditoria.evento.ver')
  @ApiOperation({
    summary: 'Bitácora',
    description:
      'Los eventos de la empresa activa entre dos días del negocio (hasta 92), del más nuevo al ' +
      'más viejo. Sin el antes y el después (están en el detalle). La historia de un registro ' +
      '(`entidad` + `entidadId`) no pide fechas ni tiene tope de días.',
  })
  @ApiRespuestaPagina(EventoResumenRespuestaDto, 'Bitácora')
  @ApiRespuestaError(
    400,
    MENSAJES_CONSULTA.desde,
    MENSAJES_CONSULTA.hasta,
    MENSAJE_RANGO_INVERTIDO,
    MENSAJE_RANGO_LARGO,
    'La fecha no es válida',
    MENSAJES_CONSULTA.usuario,
    MENSAJES_CONSULTA.accion,
    MENSAJES_CONSULTA.entidad,
    MENSAJES_CONSULTA.entidadId,
    'La página empieza en 1',
  )
  async listar(
    @Query() query: ListarEventosQueryDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<Pagina<EventoResumenVista>>> {
    const pagina = await this.consultar.listar(
      {
        desde: query.desde,
        hasta: query.hasta,
        usuarioId: query.usuarioId,
        accion: query.accion,
        entidad: query.entidad,
        entidadId: query.entidadId,
      },
      pedidoPagina(query),
      actor,
    );
    return ok(pagina, 'Bitácora');
  }

  // ─── GET /api/v1/auditoria/usuarios — Quiénes aparecen en la bitácora ───
  @Get('usuarios')
  @RequierePermiso('auditoria.evento.ver')
  @ApiOperation({
    summary: 'Quiénes aparecen en la bitácora',
    description:
      'Las personas que hicieron algo en la empresa activa, en toda su historia (también las que ' +
      'ya no tienen acceso), por nombre de usuario: las opciones del filtro «Usuario». Sale de la ' +
      'propia bitácora: no pide el permiso de ver usuarios.',
  })
  @ApiRespuestaOk([UsuarioDeBitacoraRespuestaDto], 'Usuarios de la bitácora')
  async usuarios(@UsuarioActual() actor: Actor): Promise<RespuestaApi<UsuarioDeBitacoraVista[]>> {
    return ok(await this.consultar.usuarios(actor), 'Usuarios de la bitácora');
  }

  // ─── GET /api/v1/auditoria/eventos/:id — Detalle de un evento ───
  @Get('eventos/:id')
  @RequierePermiso('auditoria.evento.ver')
  @ApiOperation({
    summary: 'Detalle de un evento',
    description: 'Con los campos que cambiaron (antes y después), desde dónde y con qué.',
  })
  @ApiRespuestaOk(EventoRespuestaDto, 'Datos del evento')
  @ApiRespuestaError(400, 'El id no es válido')
  @ApiRespuestaError(404, 'El evento no existe')
  async ver(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<EventoVista>> {
    return ok(await this.consultar.ver(id, actor), 'Datos del evento');
  }
}
