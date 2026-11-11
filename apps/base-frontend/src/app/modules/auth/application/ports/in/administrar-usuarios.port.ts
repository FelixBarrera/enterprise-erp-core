import { InjectionToken } from '@angular/core';
import type {
  AccesoQuitado,
  SesionesCerradas,
  Usuario,
  UsuarioCreado,
  UsuarioNuevo,
} from '../../../domain/usuario';

export interface AdministrarUsuariosPort {
  /**
   * Guarda lo que cambió entre `usuario` y lo escrito (el nombre y los roles): el usuario como
   * quedó, o `null` si no había nada que guardar (entonces no se llama al backend). Si se guardó el
   * nombre pero no los roles, lanza `RolesSinGuardarError` con el usuario como quedó.
   */
  guardar(
    usuario: Usuario,
    nombreCompleto: string,
    roles: readonly string[],
  ): Promise<Usuario | null>;
  /** Le quita todos sus roles en la empresa activa y cierra sus sesiones en ella. */
  quitarAcceso(id: string): Promise<AccesoQuitado>;
  /** Crea el usuario con sus roles; la respuesta trae su contraseña temporal (se ve una sola vez). */
  crear(nuevo: UsuarioNuevo): Promise<UsuarioCreado>;
  /**
   * Una contraseña temporal nueva (se ve una sola vez): la anterior deja de servir, se quita el
   * bloqueo y se cierran sus sesiones en todas sus empresas.
   */
  darContrasenaTemporal(id: string): Promise<UsuarioCreado>;
  /** Quita el bloqueo por intentos fallidos. */
  desbloquear(id: string): Promise<Usuario>;
  /** Cierra sus sesiones en todas sus empresas (las suyas: menos la actual). */
  cerrarSesiones(id: string): Promise<SesionesCerradas>;
  /** No entra en ninguna empresa y se cierran sus sesiones; sus roles quedan. */
  desactivar(id: string): Promise<Usuario>;
  /** Vuelve a entrar con los roles que tenía. */
  reactivar(id: string): Promise<Usuario>;
}

export const ADMINISTRAR_USUARIOS_PORT = new InjectionToken<AdministrarUsuariosPort>(
  'ADMINISTRAR_USUARIOS_PORT',
);
