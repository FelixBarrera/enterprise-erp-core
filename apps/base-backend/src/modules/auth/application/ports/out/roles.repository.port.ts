import type { PedidoPagina } from '../../../../../shared/application/pagina.js';
import type { DatosRol, Rol } from '../../../domain/entities/rol.entity.js';
import type { NombreRol } from '../../../domain/value-objects/nombre-rol.vo.js';

export const ROLES_REPOSITORY_PORT = Symbol('ROLES_REPOSITORY_PORT');

export interface NuevoRol {
  readonly empresaId: string;
  readonly nombre: NombreRol;
  readonly descripcion: string | null;
  readonly esAdministrador: boolean;
}

/** Filtros de la lista de roles; uno que no viene no filtra. */
export interface FiltrosRoles {
  /** Parte del nombre, sin mayúsculas ni tildes. */
  readonly texto?: string;
  readonly activo?: boolean;
}

/** Una fila de la lista: el rol y sus cuentas. */
export interface RolResumenGuardado extends DatosRol {
  /** Filas de `roles_permisos` con permisos vigentes (el Administrador no tiene: AUTH-D10). */
  readonly cantidadPermisos: number;
  /** Usuarios **activos** que lo tienen. */
  readonly cantidadUsuarios: number;
}

/**
 * `seguridad.roles` y `seguridad.usuarios_roles`. Todo método recibe la empresa y filtra por
 * ella (EMP-D4). Se une a la transacción en curso.
 */
export interface RolesRepositoryPort {
  /** El rol Administrador de la empresa; `null` si todavía no tiene. */
  buscarAdministrador(empresaId: string): Promise<Rol | null>;
  /**
   * Lo crea activo. `NombreRolDuplicadoError` si ya hay uno activo con ese nombre en la
   * empresa. Un segundo Administrador en la misma empresa lo rechaza la base (error de
   * programación: quien crea el Administrador revisa antes con `buscarAdministrador()`).
   */
  crear(nuevo: NuevoRol, creadoPor: string | null): Promise<Rol>;
  /**
   * Da el rol al usuario, en la empresa del rol. Si ya lo tenía no hace nada y devuelve
   * `false` (así un comando se puede correr dos veces).
   */
  asignar(usuarioId: string, rol: Rol, creadoPor: string | null): Promise<boolean>;
  /** Sus roles en esa empresa (activos o no), ordenados por nombre. */
  rolesDeUsuario(usuarioId: string, empresaId: string): Promise<Rol[]>;
  /**
   * Las empresas donde el usuario tiene al menos un rol **activo** (AUTH-D2), sin repetir. No
   * mira si la empresa está activa: eso lo dice `CONSULTAR_EMPRESAS_PORT`.
   */
  empresasConAcceso(usuarioId: string): Promise<string[]>;
  /**
   * Las empresas donde el usuario tiene algún rol, **activo o no** (AUTH-D12, decisión del
   * usuario en el 6.7c: un rol desactivado puede volver), sin repetir. No mira si la empresa está
   * activa.
   */
  empresasConRol(usuarioId: string): Promise<string[]>;
  /** El rol con ese id en esa empresa; `null` si no existe o es de otra empresa. */
  buscarPorId(id: string, empresaId: string): Promise<Rol | null>;
  /**
   * Igual que `buscarPorId()`, pero bloquea la fila hasta el fin de la transacción
   * (`FOR UPDATE`): dos cambios a la vez sobre el mismo rol se ordenan.
   */
  buscarParaActualizar(id: string, empresaId: string): Promise<Rol | null>;
  /**
   * Escribe nombre, descripción y `activo`. `NombreRolDuplicadoError` si otro rol activo de la
   * empresa ya tiene ese nombre (también al reactivar).
   */
  guardar(rol: Rol, actualizadoPor: string | null): Promise<void>;
  /**
   * Una página de los roles de la empresa: el Administrador primero, luego por nombre (sin
   * mayúsculas ni tildes) y por id. `total` cuenta con los mismos filtros.
   */
  listar(
    empresaId: string,
    filtros: FiltrosRoles,
    pedido: PedidoPagina,
  ): Promise<{ elementos: RolResumenGuardado[]; total: number }>;
  /**
   * Los roles **activos** de la empresa, sin paginar (son pocos): el Administrador primero, luego
   * por nombre (sin mayúsculas ni tildes) y por id. Para elegir los roles de un usuario (6.12b0).
   */
  activosDeEmpresa(empresaId: string): Promise<Rol[]>;
  /** Cuántos usuarios **activos** tienen ese rol. */
  contarUsuarios(rolId: string): Promise<number>;
  /**
   * Los roles con esos ids **en esa empresa** (los de otra o que no existen no salen), sin
   * repetir y en cualquier orden.
   */
  buscarVarios(ids: readonly string[], empresaId: string): Promise<Rol[]>;
  /**
   * Deja al usuario con exactamente esos roles en la empresa (ids de roles de esa empresa, ya
   * revisados): agrega los que faltan y quita los demás. Con la lista vacía, le quita el acceso
   * (AUTH-D2). No toca sus roles en otras empresas.
   */
  fijarDeUsuario(
    usuarioId: string,
    empresaId: string,
    rolIds: readonly string[],
    creadoPor: string | null,
  ): Promise<void>;
}
