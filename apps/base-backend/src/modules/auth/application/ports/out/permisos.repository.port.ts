import type {
  PermisoDeclarado,
  PermisoGuardado,
} from '../../../domain/services/catalogo-permisos.js';

export const PERMISOS_REPOSITORY_PORT = Symbol('PERMISOS_REPOSITORY_PORT');

/**
 * `seguridad.permisos` (el catálogo, sin empresa: es del código) y `seguridad.roles_permisos`.
 * Se une a la transacción en curso.
 */
export interface PermisosRepositoryPort {
  /**
   * Bloquea el catálogo hasta que termine la transacción: si dos servidores arrancan a la vez,
   * el segundo espera y después no encuentra nada que hacer.
   */
  bloquearCatalogo(): Promise<void>;
  /** Todos, también los obsoletos. */
  listar(): Promise<PermisoGuardado[]>;
  /** `ahora` va en `creado_en` y `actualizado_en`. */
  crear(nuevos: readonly PermisoDeclarado[], ahora: Date): Promise<void>;
  /** Escribe la descripción y la marca `obsoleto` de cada uno (por su id). */
  actualizar(cambiados: readonly PermisoGuardado[], ahora: Date): Promise<void>;
  /** Los códigos vigentes (no obsoletos), por código: los del Administrador (AUTH-D10). */
  codigosVigentes(): Promise<string[]>;
  /**
   * Los códigos vigentes que el usuario tiene en esa empresa por sus roles **activos**, sin
   * repetir y por código. No mira la marca de Administrador: eso lo decide quien llama.
   */
  codigosDeUsuario(usuarioId: string, empresaId: string): Promise<string[]>;
  /**
   * Las empresas donde el usuario tiene ese permiso por un rol **activo**, o el rol
   * Administrador activo (AUTH-D10), sin repetir. No mira si la empresa está activa.
   */
  empresasConPermiso(usuarioId: string, codigo: string): Promise<string[]>;
  /** Los códigos vigentes del rol (sus filas de `roles_permisos`), por código. */
  codigosDeRol(rolId: string): Promise<string[]>;
  /**
   * Lo mismo para varios roles en una sola consulta: cada id pedido está en el resultado (sin
   * permisos, con la lista vacía). No mira la marca de Administrador.
   */
  codigosDeRoles(rolIds: readonly string[]): Promise<Map<string, string[]>>;
  /**
   * Deja al rol con exactamente esos permisos (códigos vigentes, ya revisados): agrega los que
   * faltan y quita los demás, también los obsoletos que tuviera.
   */
  fijarDeRol(rolId: string, codigos: readonly string[], creadoPor: string | null): Promise<void>;
}
