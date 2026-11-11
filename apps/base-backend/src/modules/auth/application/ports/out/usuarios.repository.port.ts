import type { PedidoPagina } from '../../../../../shared/application/pagina.js';
import type { Usuario } from '../../../domain/entities/usuario.entity.js';
import type { NombreCompleto } from '../../../domain/value-objects/nombre-completo.vo.js';
import type { NombreUsuario } from '../../../domain/value-objects/nombre-usuario.vo.js';

export const USUARIOS_REPOSITORY_PORT = Symbol('USUARIOS_REPOSITORY_PORT');

export interface NuevoUsuario {
  readonly nombreUsuario: NombreUsuario;
  readonly nombreCompleto: NombreCompleto;
  readonly hashContrasena: string;
  /** `true` con una contraseña temporal o la del primer administrador (AUTH-D13). */
  readonly debeCambiarContrasena: boolean;
}

/** Filtros de la lista de usuarios de una empresa; uno que no viene no filtra. */
export interface FiltrosUsuarios {
  /** Parte del nombre completo o del nombre de usuario, sin mayúsculas ni tildes. */
  readonly texto?: string;
  /** El usuario activo o desactivado (la persona, no sus roles). */
  readonly activo?: boolean;
  /** Solo los que tienen ese rol (de la empresa: uno de otra no da ninguno). */
  readonly rolId?: string;
}

/** Un rol del usuario en la empresa, como sale en la lista y en la ficha. */
export interface RolDeUsuarioGuardado {
  readonly id: string;
  readonly nombre: string;
  readonly esAdministrador: boolean;
  readonly activo: boolean;
}

/** Una fila de la lista: el usuario y sus roles en la empresa. */
export interface UsuarioResumenGuardado {
  readonly id: string;
  readonly nombreUsuario: string;
  readonly nombreCompleto: string;
  readonly activo: boolean;
  readonly bloqueadoHasta: Date | null;
  readonly ultimoIngresoEn: Date | null;
  readonly debeCambiarContrasena: boolean;
  /** Sus roles en esa empresa (activos o no), por nombre sin mayúsculas ni tildes. */
  readonly roles: readonly RolDeUsuarioGuardado[];
}

/** `seguridad.usuarios`. Se une a la transacción en curso. */
export interface UsuariosRepositoryPort {
  /** `null` si no existe (o si el id no tiene forma de UUID). */
  buscarPorId(id: string): Promise<Usuario | null>;
  /**
   * Igual, pero bloquea la fila hasta el final de la transacción (`FOR UPDATE`): dos logins a la
   * vez no se pisan la cuenta de intentos fallidos.
   */
  buscarParaActualizar(id: string): Promise<Usuario | null>;
  /** Activo o no: el nombre nunca se reutiliza (AUTH-D3). */
  buscarPorNombreUsuario(nombre: NombreUsuario): Promise<Usuario | null>;
  /** Lo crea activo y sin fallos. `NombreUsuarioDuplicadoError` si el nombre ya existe. */
  crear(nuevo: NuevoUsuario, creadoPor: string | null): Promise<Usuario>;
  /** Guarda todo lo que cambia del usuario (el nombre de usuario no cambia). */
  guardar(usuario: Usuario, actualizadoPor: string | null): Promise<void>;
  /**
   * Una página de los usuarios **de la empresa** (los que tienen algún rol en ella, activo o
   * no), por nombre completo (sin mayúsculas ni tildes) y por id. `total` cuenta con los mismos
   * filtros. Sin consultas por fila: los roles salen en la misma consulta.
   */
  listarDeEmpresa(
    empresaId: string,
    filtros: FiltrosUsuarios,
    pedido: PedidoPagina,
  ): Promise<{ elementos: UsuarioResumenGuardado[]; total: number }>;
}
