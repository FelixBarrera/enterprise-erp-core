import { InjectionToken } from '@angular/core';
import type { Pagina, PedidoPagina } from '../../../../../shared/domain/pagina';
import type { EventoDetalle, EventoResumen, UsuarioDeBitacora } from '../../../domain/evento';
import type { FiltrosBitacora } from '../../../domain/filtros-bitacora';

export interface ConsultarBitacoraPort {
  /** Lo que pasó en la empresa activa, del más nuevo al más viejo. */
  listar(filtros: FiltrosBitacora, pedido: PedidoPagina): Promise<Pagina<EventoResumen>>;
  /** Quienes hicieron algo en la empresa (también los que ya no tienen acceso), por usuario. */
  usuarios(): Promise<UsuarioDeBitacora[]>;
  /** Un evento con lo que cambió y desde dónde (de la empresa activa). */
  ver(id: string): Promise<EventoDetalle>;
  /**
   * Lo que permite cada permiso («Ver usuarios»), por código, para mostrar los permisos de un rol.
   * El catálogo pide «Ver roles»: llamarlo solo con ese permiso.
   */
  descripcionesPermisos(): Promise<ReadonlyMap<string, string>>;
}

export const CONSULTAR_BITACORA_PORT = new InjectionToken<ConsultarBitacoraPort>(
  'CONSULTAR_BITACORA_PORT',
);
