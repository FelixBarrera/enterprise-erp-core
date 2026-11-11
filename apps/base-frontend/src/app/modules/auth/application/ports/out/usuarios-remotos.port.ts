import { InjectionToken } from '@angular/core';
import type { Pagina, PedidoPagina } from '../../../../../shared/domain/pagina';
import type {
  AccesoQuitado,
  CambiosUsuario,
  FiltrosUsuarios,
  RolAsignable,
  SesionesCerradas,
  Usuario,
  UsuarioCreado,
  UsuarioNuevo,
  UsuarioResumen,
} from '../../../domain/usuario';

/** Los usuarios de la empresa activa en el backend (`/usuarios`). Los errores llegan como `ErrorHttp`. */
export interface UsuariosRemotosPort {
  /** `GET /usuarios`. */
  listar(filtros: FiltrosUsuarios, pedido: PedidoPagina): Promise<Pagina<UsuarioResumen>>;
  /** `GET /usuarios/:id`. */
  ver(id: string): Promise<Usuario>;
  /** `GET /usuarios/roles-asignables`. */
  rolesAsignables(): Promise<RolAsignable[]>;
  /** `PATCH /usuarios/:id` con solo lo que cambió. */
  editar(id: string, cambios: CambiosUsuario): Promise<Usuario>;
  /** `PUT /usuarios/:id/roles`: queda con exactamente estos. */
  fijarRoles(id: string, roles: readonly string[]): Promise<Usuario>;
  /** `POST /usuarios/:id/quitar-acceso`. */
  quitarAcceso(id: string): Promise<AccesoQuitado>;
  /** `POST /usuarios`. */
  crear(nuevo: UsuarioNuevo): Promise<UsuarioCreado>;
  /** `POST /usuarios/:id/contrasena-temporal`. */
  darContrasenaTemporal(id: string): Promise<UsuarioCreado>;
  /** `POST /usuarios/:id/desbloquear`. */
  desbloquear(id: string): Promise<Usuario>;
  /** `POST /usuarios/:id/cerrar-sesiones`. */
  cerrarSesiones(id: string): Promise<SesionesCerradas>;
  /** `POST /usuarios/:id/desactivar`. */
  desactivar(id: string): Promise<Usuario>;
  /** `POST /usuarios/:id/reactivar`. */
  reactivar(id: string): Promise<Usuario>;
}

export const USUARIOS_REMOTOS_PORT = new InjectionToken<UsuariosRemotosPort>(
  'USUARIOS_REMOTOS_PORT',
);
