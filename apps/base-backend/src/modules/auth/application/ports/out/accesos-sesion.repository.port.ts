import type { Sesion } from '../../../domain/entities/sesion.entity.js';

export const ACCESOS_SESION_PORT = Symbol('ACCESOS_SESION_PORT');

/** Lo que revisa el guard en cada petición, leído junto (DBA-02). */
export interface AccesoSesion {
  readonly sesion: Sesion;
  readonly usuario: {
    readonly nombreUsuario: string;
    readonly activo: boolean;
    readonly debeCambiarContrasena: boolean;
  };
  /** La empresa activa de la sesión está activa. */
  readonly empresaActiva: boolean;
  /** El usuario tiene al menos un rol **activo** en la empresa de la sesión (AUTH-D2). */
  readonly tieneRolActivo: boolean;
  /** Y uno de ellos es el Administrador (AUTH-D10). */
  readonly esAdministrador: boolean;
  /**
   * Uno de sus roles **activos** en esa empresa tiene el permiso pedido, y está vigente. `false`
   * si no se pidió ninguno. No mira la marca de Administrador: eso lo decide el caso de uso.
   */
  readonly tienePermiso: boolean;
}

/**
 * La lectura del guard: la sesión con su usuario, su empresa, sus roles y el permiso de la ruta
 * en **una sola consulta** (docs/modulos/auth-usuarios.md, sección 5). Sin bloquear filas.
 */
export interface AccesosSesionPort {
  /**
   * `null` si la sesión no existe (o el id no tiene forma de UUID). `permiso`: el de
   * `@RequierePermiso()`, o `null` si la ruta no pide ninguno.
   */
  buscar(sesionId: string, permiso: string | null): Promise<AccesoSesion | null>;
}
