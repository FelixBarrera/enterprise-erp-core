import type { Actor } from '../../../../../shared/application/actor.js';
import type { UsuarioCreado } from './accesos-usuarios.port.js';
import type { UsuarioVista } from './consultar-usuarios.port.js';

export const ACCIONES_USUARIOS_PORT = Symbol('ACCIONES_USUARIOS_PORT');

/** La ficha y la contraseña temporal nueva, que se muestra esta sola vez (AUTH-D13). */
export type ContrasenaTemporalDada = UsuarioCreado;

export interface SesionesCerradas {
  readonly id: string;
  /** Cuántas sesiones suyas se cerraron (en todas sus empresas). */
  readonly sesionesCerradas: number;
}

/**
 * Acciones sobre la persona, desde su ficha en la empresa activa (6.7e). Escriben y registran en
 * la bitácora en la misma transacción; si nada cambia, no escriben ni registran (las reglas se
 * revisan igual). `UsuarioNoEncontradoError` si no tiene ningún rol en la empresa activa.
 *
 * Contraseña temporal, desactivar y reactivar son de la persona: piden el permiso en todas sus
 * empresas activas (AUTH-D12) y no se hacen a alguien con más poder (`EscaladaError`, decisión
 * del usuario, 6.7e). Desbloquear y cerrar sesiones no dan acceso a nadie: basta el permiso en
 * la empresa activa.
 */
export interface AccionesUsuariosPort {
  /**
   * `auth.usuario.restablecer`: una contraseña temporal generada por el sistema (AUTH-D13). Quita
   * el bloqueo y cierra todas sus sesiones. No a uno mismo ni a un usuario desactivado.
   */
  darContrasenaTemporal(id: string, actor: Actor): Promise<ContrasenaTemporalDada>;
  /** `auth.usuario.restablecer`: quita el bloqueo por intentos fallidos. */
  desbloquear(id: string, actor: Actor): Promise<UsuarioVista>;
  /**
   * `auth.usuario.restablecer`: cierra todas sus sesiones, en todas sus empresas (equipo perdido
   * o robado). Sobre uno mismo, deja abierta `sesionActualId`.
   */
  cerrarSesiones(id: string, sesionActualId: string, actor: Actor): Promise<SesionesCerradas>;
  /**
   * `auth.usuario.desactivar`: no entra en ninguna empresa y se cierran sus sesiones. No a uno
   * mismo; en cada empresa donde es administrador tiene que quedar otro (AUTH-D11 (4)).
   */
  desactivar(id: string, actor: Actor): Promise<UsuarioVista>;
  /** `auth.usuario.desactivar`: vuelve a entrar con los roles que tenía. */
  reactivar(id: string, actor: Actor): Promise<UsuarioVista>;
}
