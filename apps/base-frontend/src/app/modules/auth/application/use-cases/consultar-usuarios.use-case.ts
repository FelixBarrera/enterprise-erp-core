import { inject, Injectable } from '@angular/core';
import type { Pagina, PedidoPagina } from '../../../../shared/domain/pagina';
import type { FiltrosUsuarios, RolAsignable, Usuario, UsuarioResumen } from '../../domain/usuario';
import type { ConsultarUsuariosPort } from '../ports/in/consultar-usuarios.port';
import { USUARIOS_REMOTOS_PORT } from '../ports/out/usuarios-remotos.port';

@Injectable()
export class ConsultarUsuariosUseCase implements ConsultarUsuariosPort {
  private readonly remotos = inject(USUARIOS_REMOTOS_PORT);

  listar(filtros: FiltrosUsuarios, pedido: PedidoPagina): Promise<Pagina<UsuarioResumen>> {
    return this.remotos.listar(filtros, pedido);
  }

  ver(id: string): Promise<Usuario> {
    return this.remotos.ver(id);
  }

  rolesAsignables(): Promise<RolAsignable[]> {
    return this.remotos.rolesAsignables();
  }
}
