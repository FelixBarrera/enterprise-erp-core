import { InjectionToken } from '@angular/core';
import type { Pagina, PedidoPagina } from '../../../../../shared/domain/pagina';
import type { EventoDetalle, EventoResumen, UsuarioDeBitacora } from '../../../domain/evento';
import type { FiltrosBitacora } from '../../../domain/filtros-bitacora';

/** La bitácora de la empresa activa en el backend (`/auditoria`). Los errores llegan como `ErrorHttp`. */
export interface BitacoraRemotaPort {
  /** `GET /auditoria/eventos`. */
  listar(filtros: FiltrosBitacora, pedido: PedidoPagina): Promise<Pagina<EventoResumen>>;
  /** `GET /auditoria/usuarios`. */
  usuarios(): Promise<UsuarioDeBitacora[]>;
  /** `GET /auditoria/eventos/:id`. */
  ver(id: string): Promise<EventoDetalle>;
  /** `GET /permisos` (pide `auth.rol.ver`), como código → descripción. */
  descripcionesPermisos(): Promise<ReadonlyMap<string, string>>;
}

export const BITACORA_REMOTA_PORT = new InjectionToken<BitacoraRemotaPort>('BITACORA_REMOTA_PORT');
