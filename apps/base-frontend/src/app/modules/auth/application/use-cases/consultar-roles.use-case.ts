import { inject, Injectable } from '@angular/core';
import type { Pagina, PedidoPagina } from '../../../../shared/domain/pagina';
import type { GrupoPermisos } from '../../domain/permisos-rol';
import type { FiltrosRoles, Rol, RolResumen } from '../../domain/rol';
import type { ConsultarRolesPort } from '../ports/in/consultar-roles.port';
import { ROLES_REMOTOS_PORT } from '../ports/out/roles-remotos.port';

@Injectable()
export class ConsultarRolesUseCase implements ConsultarRolesPort {
  private readonly remotos = inject(ROLES_REMOTOS_PORT);

  listar(filtros: FiltrosRoles, pedido: PedidoPagina): Promise<Pagina<RolResumen>> {
    return this.remotos.listar(filtros, pedido);
  }

  ver(id: string): Promise<Rol> {
    return this.remotos.ver(id);
  }

  catalogo(): Promise<GrupoPermisos[]> {
    return this.remotos.catalogo();
  }
}
