import { inject, Injectable } from '@angular/core';
import { RolesSinGuardarError } from '../../domain/errors/roles-sin-guardar.error';
import {
  type AccesoQuitado,
  cambiosDeUsuario,
  cantidadDeCambiosDeRoles,
  normalizarNombreUsuario,
  type SesionesCerradas,
  type Usuario,
  type UsuarioCreado,
  type UsuarioNuevo,
} from '../../domain/usuario';
import type { AdministrarUsuariosPort } from '../ports/in/administrar-usuarios.port';
import { USUARIOS_REMOTOS_PORT } from '../ports/out/usuarios-remotos.port';

/**
 * Dar de alta (crear o dar acceso), guardar la ficha de un usuario, quitarle el acceso y las
 * acciones sobre la persona (contraseña temporal, desbloquear, cerrar sesiones, desactivar y
 * reactivar). Manda solo lo que cambió; las reglas (la escalada, el último administrador, sus
 * propios roles, la otra empresa) las dice el backend.
 */
@Injectable()
export class AdministrarUsuariosUseCase implements AdministrarUsuariosPort {
  private readonly remotos = inject(USUARIOS_REMOTOS_PORT);

  /** Primero el nombre (no depende de nada), luego los roles. */
  async guardar(
    usuario: Usuario,
    nombreCompleto: string,
    roles: readonly string[],
  ): Promise<Usuario | null> {
    const cambios = cambiosDeUsuario(usuario, nombreCompleto);
    const cambianRoles =
      cantidadDeCambiosDeRoles(new Set(roles), new Set(usuario.roles.map((r) => r.id))) > 0;
    if (cambios === null && !cambianRoles) return null;
    const conNombre = cambios === null ? usuario : await this.remotos.editar(usuario.id, cambios);
    if (!cambianRoles) return conNombre;
    try {
      return await this.remotos.fijarRoles(usuario.id, roles);
    } catch (error) {
      if (cambios === null) throw error;
      throw new RolesSinGuardarError(conNombre, error);
    }
  }

  quitarAcceso(id: string): Promise<AccesoQuitado> {
    return this.remotos.quitarAcceso(id);
  }

  /** El nombre de usuario como lo guarda el backend; el nombre completo, sin espacios en los extremos. */
  crear(nuevo: UsuarioNuevo): Promise<UsuarioCreado> {
    return this.remotos.crear({
      nombreUsuario: normalizarNombreUsuario(nuevo.nombreUsuario),
      nombreCompleto: nuevo.nombreCompleto.trim(),
      roles: nuevo.roles,
    });
  }

  darContrasenaTemporal(id: string): Promise<UsuarioCreado> {
    return this.remotos.darContrasenaTemporal(id);
  }

  desbloquear(id: string): Promise<Usuario> {
    return this.remotos.desbloquear(id);
  }

  cerrarSesiones(id: string): Promise<SesionesCerradas> {
    return this.remotos.cerrarSesiones(id);
  }

  desactivar(id: string): Promise<Usuario> {
    return this.remotos.desactivar(id);
  }

  reactivar(id: string): Promise<Usuario> {
    return this.remotos.reactivar(id);
  }
}
