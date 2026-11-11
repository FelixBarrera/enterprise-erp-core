import type { Actor } from '../../../../../shared/application/actor.js';
import type { UsuarioVista } from './consultar-usuarios.port.js';

export const ADMINISTRAR_USUARIOS_PORT = Symbol('ADMINISTRAR_USUARIOS_PORT');

/** Lo que se cambia; un campo que no viene queda igual. */
export interface EditarUsuarioComando {
  readonly nombreCompleto?: string;
}

/**
 * Cambios sobre los usuarios de la empresa activa. Escriben y registran en la bitácora en la
 * misma transacción; si nada cambia, no escriben ni registran. `UsuarioNoEncontradoError` si el
 * usuario no tiene ningún rol en la empresa activa. (6.7d suma crear, dar acceso, roles y quitar
 * acceso.)
 */
export interface AdministrarUsuariosPort {
  /**
   * `auth.usuario.editar`: el nombre completo. Es de la persona: quien lo cambia necesita el
   * permiso en todas las empresas activas del usuario (AUTH-D12, `UsuarioDeOtraEmpresaError`).
   */
  editar(id: string, comando: EditarUsuarioComando, actor: Actor): Promise<UsuarioVista>;
}
