import { InjectionToken } from '@angular/core';
import type { DatosRolEscritos, Rol } from '../../../domain/rol';

export interface AdministrarRolesPort {
  /**
   * Guarda lo que cambió entre `rol` y lo escrito (datos y permisos): el rol como quedó, o `null`
   * si no había nada que guardar (entonces no se llama al backend). Si se guardaron los datos pero
   * no los permisos, lanza `PermisosSinGuardarError` con el rol como quedó.
   */
  guardar(rol: Rol, escritos: DatosRolEscritos, permisos: readonly string[]): Promise<Rol | null>;
  /** «Nuevo rol»: con sus datos y sus permisos, en una sola petición. */
  crear(escritos: DatosRolEscritos, permisos: readonly string[]): Promise<Rol>;
  desactivar(id: string): Promise<Rol>;
  reactivar(id: string): Promise<Rol>;
}

export const ADMINISTRAR_ROLES_PORT = new InjectionToken<AdministrarRolesPort>(
  'ADMINISTRAR_ROLES_PORT',
);
