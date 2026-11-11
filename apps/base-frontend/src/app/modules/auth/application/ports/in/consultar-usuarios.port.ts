import { InjectionToken } from '@angular/core';
import type { Pagina, PedidoPagina } from '../../../../../shared/domain/pagina';
import type {
  FiltrosUsuarios,
  RolAsignable,
  Usuario,
  UsuarioResumen,
} from '../../../domain/usuario';

export interface ConsultarUsuariosPort {
  /** Los usuarios de la empresa activa, por nombre, con sus roles en ella. */
  listar(filtros: FiltrosUsuarios, pedido: PedidoPagina): Promise<Pagina<UsuarioResumen>>;
  /** La ficha de un usuario: datos, roles y sesiones abiertas en la empresa activa. */
  ver(id: string): Promise<Usuario>;
  /** Los roles activos de la empresa, con los que quien opera puede dar. */
  rolesAsignables(): Promise<RolAsignable[]>;
}

export const CONSULTAR_USUARIOS_PORT = new InjectionToken<ConsultarUsuariosPort>(
  'CONSULTAR_USUARIOS_PORT',
);
