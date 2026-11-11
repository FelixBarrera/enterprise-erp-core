import { inject, Injectable } from '@angular/core';
import { PermisosSinGuardarError } from '../../domain/errors/permisos-sin-guardar.error';
import { cantidadDeCambiosDePermisos } from '../../domain/permisos-rol';
import { cambiosDeRol, type DatosRolEscritos, nuevoRol, type Rol } from '../../domain/rol';
import type { AdministrarRolesPort } from '../ports/in/administrar-roles.port';
import { ROLES_REMOTOS_PORT } from '../ports/out/roles-remotos.port';

/**
 * Crear, guardar, desactivar y reactivar un rol. Manda solo lo que cambió; las reglas (el
 * Administrador no se cambia, nombres repetidos, la escalada) las dice el backend.
 */
@Injectable()
export class AdministrarRolesUseCase implements AdministrarRolesPort {
  private readonly remotos = inject(ROLES_REMOTOS_PORT);

  /** Primero los datos (un nombre repetido no deja nada a medias), luego los permisos. */
  async guardar(
    rol: Rol,
    escritos: DatosRolEscritos,
    permisos: readonly string[],
  ): Promise<Rol | null> {
    const cambios = cambiosDeRol(rol, escritos);
    const cambianPermisos =
      cantidadDeCambiosDePermisos(new Set(permisos), new Set(rol.permisos)) > 0;
    if (cambios === null && !cambianPermisos) return null;
    const conDatos = cambios === null ? rol : await this.remotos.editar(rol.id, cambios);
    if (!cambianPermisos) return conDatos;
    try {
      return await this.remotos.fijarPermisos(rol.id, permisos);
    } catch (error) {
      if (cambios === null) throw error;
      throw new PermisosSinGuardarError(conDatos, error);
    }
  }

  crear(escritos: DatosRolEscritos, permisos: readonly string[]): Promise<Rol> {
    return this.remotos.crear(nuevoRol(escritos, permisos));
  }

  desactivar(id: string): Promise<Rol> {
    return this.remotos.desactivar(id);
  }

  reactivar(id: string): Promise<Rol> {
    return this.remotos.reactivar(id);
  }
}
