import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Pagina, PedidoPagina } from '../../../../../../shared/domain/pagina';
import type { BitacoraRemotaPort } from '../../../../application/ports/out/bitacora-remota.port';
import type {
  CambiosEvento,
  EventoDetalle,
  EventoResumen,
  UsuarioDeBitacora,
  ValorJson,
} from '../../../../domain/evento';
import type { FiltrosBitacora } from '../../../../domain/filtros-bitacora';
import {
  BitacoraApi,
  type EventoDetalleDto,
  type EventoResumenDto,
  type ParametrosListaEventos,
  type UsuarioDeBitacoraDto,
} from './bitacora.api';

const aEvento = (dto: EventoResumenDto): EventoResumen => ({
  id: dto.id,
  ocurridoEn: dto.ocurridoEn,
  usuarioId: dto.usuarioId,
  nombreUsuario: dto.nombreUsuario,
  accion: dto.accion,
  entidad: dto.entidad,
  entidadId: dto.entidadId,
  entidadNombre: dto.entidadNombre,
});

/** Lo que llega del `jsonb`, como `ValorJson` (lo que un JSON no puede traer, como `null`). */
function aValorJson(valor: unknown): ValorJson {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : String(valor);
  if (Array.isArray(valor)) return valor.map(aValorJson);
  if (typeof valor === 'object') return aCambios(valor as Record<string, unknown>);
  return null;
}

function aCambios(objeto: Record<string, unknown>): CambiosEvento {
  return Object.fromEntries(Object.entries(objeto).map(([campo, v]) => [campo, aValorJson(v)]));
}

const aDetalle = (dto: EventoDetalleDto): EventoDetalle => ({
  ...aEvento(dto),
  antes: dto.antes === null ? null : aCambios(dto.antes),
  despues: dto.despues === null ? null : aCambios(dto.despues),
  ip: dto.ip,
  navegador: dto.navegador,
  requestId: dto.requestId,
});

const aUsuario = (dto: UsuarioDeBitacoraDto): UsuarioDeBitacora => ({
  usuarioId: dto.usuarioId,
  nombreUsuario: dto.nombreUsuario,
});

/**
 * Los filtros de la pantalla, como los entiende `GET /auditoria/eventos`. Una fecha vacía (solo en
 * la historia de un registro) no se manda: sin límite.
 */
export function parametrosDeListaEventos(
  filtros: FiltrosBitacora,
  pedido: PedidoPagina,
): ParametrosListaEventos {
  return {
    ...(filtros.desde === '' ? {} : { desde: filtros.desde }),
    ...(filtros.hasta === '' ? {} : { hasta: filtros.hasta }),
    ...(filtros.usuario === '' ? {} : { usuarioId: filtros.usuario }),
    ...(filtros.accion === '' ? {} : { accion: filtros.accion }),
    ...(filtros.registro === null
      ? {}
      : { entidad: filtros.registro.entidad, entidadId: filtros.registro.entidadId }),
    pagina: String(pedido.pagina),
    tamano: String(pedido.tamano),
  };
}

@Injectable()
export class BitacoraRemotaHttpAdapter implements BitacoraRemotaPort {
  private readonly api = inject(BitacoraApi);

  async listar(filtros: FiltrosBitacora, pedido: PedidoPagina): Promise<Pagina<EventoResumen>> {
    const { data } = await firstValueFrom(
      this.api.eventos(parametrosDeListaEventos(filtros, pedido)),
    );
    return { ...data, elementos: data.elementos.map(aEvento) };
  }

  async usuarios(): Promise<UsuarioDeBitacora[]> {
    return (await firstValueFrom(this.api.usuarios())).data.map(aUsuario);
  }

  async ver(id: string): Promise<EventoDetalle> {
    return aDetalle((await firstValueFrom(this.api.evento(id))).data);
  }

  async descripcionesPermisos(): Promise<ReadonlyMap<string, string>> {
    const { data } = await firstValueFrom(this.api.permisos());
    return new Map(data.flatMap((g) => g.permisos.map((p) => [p.codigo, p.descripcion] as const)));
  }
}
