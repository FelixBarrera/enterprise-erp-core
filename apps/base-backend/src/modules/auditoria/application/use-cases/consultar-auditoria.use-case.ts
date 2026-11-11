import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/application/actor.js';
import {
  crearPagina,
  type Pagina,
  type PedidoPagina,
} from '../../../../shared/application/pagina.js';
import { FechaFiscal } from '../../../../shared/domain/value-objects/fecha-fiscal.vo.js';
import {
  EventoNoEncontradoError,
  RangoFechasInvalidoError,
} from '../../domain/errors/auditoria.errors.js';
import {
  MENSAJE_FECHAS_OBLIGATORIAS,
  type RangoAbierto,
  rangoDeConsulta,
  rangoDeHistoria,
} from '../../domain/rango-consulta.js';
import type {
  ConsultarAuditoriaPort,
  EventoResumenVista,
  EventoVista,
  FiltrosConsultaAuditoria,
  UsuarioDeBitacoraVista,
} from '../ports/in/consultar-auditoria.port.js';
import {
  type EventoResumenGuardado,
  EVENTOS_AUDITORIA_REPOSITORY_PORT,
  type EventosAuditoriaRepositoryPort,
} from '../ports/out/eventos-auditoria.repository.port.js';

/** La lista y el detalle de la bitácora de la empresa activa (`auditoria.evento.ver`). */
@Injectable()
export class ConsultarAuditoriaUseCase implements ConsultarAuditoriaPort {
  constructor(
    @Inject(EVENTOS_AUDITORIA_REPOSITORY_PORT)
    private readonly eventos: EventosAuditoriaRepositoryPort,
  ) {}

  async listar(
    filtros: FiltrosConsultaAuditoria,
    pedido: PedidoPagina,
    actor: Actor,
  ): Promise<Pagina<EventoResumenVista>> {
    // El rango se revisa antes que la empresa: un pedido mal armado es 400 siempre.
    const rango = rangoDeFiltros(filtros);
    // Sin empresa activa no hay bitácora que ver (AUD-D5): los eventos sin empresa no salen.
    if (actor.empresaId === null) {
      return crearPagina([], 0, pedido);
    }
    const { elementos, total } = await this.eventos.listar(
      actor.empresaId,
      {
        ...rango,
        usuarioId: filtros.usuarioId,
        accion: filtros.accion,
        entidad: filtros.entidad,
        entidadId: filtros.entidadId,
      },
      pedido,
    );
    return crearPagina(elementos.map(resumen), total, pedido);
  }

  async usuarios(actor: Actor): Promise<UsuarioDeBitacoraVista[]> {
    if (actor.empresaId === null) {
      return [];
    }
    const usuarios = await this.eventos.usuariosDe(actor.empresaId);
    return usuarios.map((u) => ({ usuarioId: u.usuarioId, nombreUsuario: u.nombreUsuario }));
  }

  async ver(id: string, actor: Actor): Promise<EventoVista> {
    const evento =
      actor.empresaId === null ? null : await this.eventos.buscarPorId(id, actor.empresaId);
    if (evento === null) {
      throw new EventoNoEncontradoError();
    }
    return {
      ...resumen(evento),
      antes: evento.antes,
      despues: evento.despues,
      ip: evento.ip,
      navegador: evento.navegador,
      requestId: evento.requestId,
    };
  }
}

/** La historia de un registro sin tope de días; cualquier otra búsqueda, de 1 a 92 días. */
function rangoDeFiltros(filtros: FiltrosConsultaAuditoria): RangoAbierto {
  const fecha = (texto?: string) =>
    texto === undefined ? undefined : FechaFiscal.desdeTexto(texto);
  if (filtros.entidad !== undefined && filtros.entidadId !== undefined) {
    return rangoDeHistoria(fecha(filtros.desde), fecha(filtros.hasta));
  }
  if (filtros.desde === undefined || filtros.hasta === undefined) {
    throw new RangoFechasInvalidoError(MENSAJE_FECHAS_OBLIGATORIAS);
  }
  return rangoDeConsulta(
    FechaFiscal.desdeTexto(filtros.desde),
    FechaFiscal.desdeTexto(filtros.hasta),
  );
}

function resumen(evento: EventoResumenGuardado): EventoResumenVista {
  return {
    id: evento.id,
    ocurridoEn: evento.ocurridoEn,
    usuarioId: evento.usuarioId,
    nombreUsuario: evento.nombreUsuario,
    accion: evento.accion,
    entidad: evento.entidad,
    entidadId: evento.entidadId,
    entidadNombre: evento.entidadNombre,
  };
}
