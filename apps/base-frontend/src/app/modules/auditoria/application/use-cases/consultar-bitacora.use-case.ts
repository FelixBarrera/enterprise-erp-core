import { inject, Injectable } from '@angular/core';
import type { Pagina, PedidoPagina } from '../../../../shared/domain/pagina';
import type { EventoDetalle, EventoResumen, UsuarioDeBitacora } from '../../domain/evento';
import type { FiltrosBitacora } from '../../domain/filtros-bitacora';
import type { ConsultarBitacoraPort } from '../ports/in/consultar-bitacora.port';
import { BITACORA_REMOTA_PORT } from '../ports/out/bitacora-remota.port';

@Injectable()
export class ConsultarBitacoraUseCase implements ConsultarBitacoraPort {
  private readonly remota = inject(BITACORA_REMOTA_PORT);

  listar(filtros: FiltrosBitacora, pedido: PedidoPagina): Promise<Pagina<EventoResumen>> {
    return this.remota.listar(filtros, pedido);
  }

  usuarios(): Promise<UsuarioDeBitacora[]> {
    return this.remota.usuarios();
  }

  ver(id: string): Promise<EventoDetalle> {
    return this.remota.ver(id);
  }

  descripcionesPermisos(): Promise<ReadonlyMap<string, string>> {
    return this.remota.descripcionesPermisos();
  }
}
