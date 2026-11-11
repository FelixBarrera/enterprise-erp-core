import type { Actor } from '../../../../../shared/application/actor.js';
import type { UsuarioVista } from './consultar-usuarios.port.js';

export const ACCESOS_USUARIOS_PORT = Symbol('ACCESOS_USUARIOS_PORT');

export interface CrearUsuarioComando {
  readonly nombreUsuario: string;
  readonly nombreCompleto: string;
  /** Ids de roles de la empresa activa: al menos uno (decisión del usuario, 6.7c). */
  readonly roles: readonly string[];
}

export interface UsuarioCreado {
  readonly usuario: UsuarioVista;
  /** La contraseña temporal (AUTH-D13): se muestra esta sola vez y no se guarda en ningún lado. */
  readonly contrasenaTemporal: string;
}

export interface AccesoQuitado {
  readonly id: string;
  /** Cuántas sesiones suyas en esta empresa se cerraron. */
  readonly sesionesCerradas: number;
}

/**
 * Lo que es de la empresa (AUTH-D12): quién entra a la empresa activa y con qué roles. Lo maneja
 * cada empresa, aunque el usuario trabaje también en otras. Siempre con las reglas contra la
 * escalada (AUTH-D11): nadie cambia sus propios roles, quien no es administrador solo da roles
 * cuyos permisos tiene, solo un administrador da o quita el rol Administrador, y la empresa no
 * se queda sin administrador activo. No se da un rol desactivado (decisión del usuario, 6.7d).
 * Escriben y registran en la bitácora en la misma transacción.
 */
export interface AccesosUsuariosPort {
  /**
   * `auth.usuario.crear`: un usuario nuevo con sus roles y una contraseña temporal generada por
   * el sistema, que debe cambiar al entrar (AUTH-D13). `NombreUsuarioDuplicadoError` si el nombre
   * ya existe (aunque esté desactivado: AUTH-D3).
   */
  crear(comando: CrearUsuarioComando, actor: Actor): Promise<UsuarioCreado>;
  /**
   * `auth.usuario.asignar_roles`: lo deja con exactamente esos roles en la empresa activa (al
   * menos uno: sin ninguno es `quitarAcceso()`). Los que ya tenía desactivados puede seguir
   * teniéndolos. Si nada cambia, no escribe ni registra.
   */
  fijarRoles(id: string, roles: readonly string[], actor: Actor): Promise<UsuarioVista>;
  /**
   * `auth.usuario.asignar_roles`: le quita todos sus roles en la empresa activa y cierra sus
   * sesiones en ella (`ACCESO_QUITADO`). Sus roles y sesiones en otras empresas siguen.
   */
  quitarAcceso(id: string, actor: Actor): Promise<AccesoQuitado>;
}
