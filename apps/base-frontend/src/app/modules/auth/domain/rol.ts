/** Cuándo y quién, de la bitácora de la empresa (`por: null`: lo hizo el sistema). */
export interface HuellaRol {
  readonly en: string;
  readonly por: string | null;
}

/** Una fila de la lista de roles (`GET /roles`). */
export interface RolResumen {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  /** Tiene todos los permisos y no se cambia. */
  readonly esAdministrador: boolean;
  /** Un rol desactivado no da permisos. */
  readonly activo: boolean;
  /** Usuarios activos que lo tienen. */
  readonly cantidadUsuarios: number;
  /** Permisos que da (el Administrador, todos los del catálogo). */
  readonly cantidadPermisos: number;
}

/** La ficha de un rol (`GET /roles/:id` y lo que responden sus cambios). */
export interface Rol {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly esAdministrador: boolean;
  readonly activo: boolean;
  readonly cantidadUsuarios: number;
  /** Sus permisos, por código. */
  readonly permisos: readonly string[];
  readonly creado: HuellaRol | null;
  readonly modificado: HuellaRol | null;
}

/** Los mismos topes que el backend (`NombreRol`, `descripcionRol()`). */
export const LARGO_MAXIMO_NOMBRE_ROL = 80;
export const LARGO_MAXIMO_DESCRIPCION_ROL = 250;
export const LARGO_MAXIMO_BUSQUEDA_ROL = 80;

/** «Estado» en los filtros de la lista. */
export const ESTADOS_ROL = ['todos', 'activos', 'desactivados'] as const;
export type EstadoRol = (typeof ESTADOS_ROL)[number];

export interface FiltrosRoles {
  /** Parte del nombre (sin mayúsculas ni tildes: lo resuelve el backend). */
  readonly texto: string;
  readonly estado: EstadoRol;
}

export const FILTROS_ROLES_INICIALES: FiltrosRoles = { texto: '', estado: 'todos' };

/** Lo que escribe la persona en «Datos del rol». */
export interface DatosRolEscritos {
  readonly nombre: string;
  readonly descripcion: string;
}

/** Lo que se manda en `PATCH /roles/:id`: solo lo que cambió (`descripcion: null` la quita). */
export interface CambiosRol {
  readonly nombre?: string;
  readonly descripcion?: string | null;
}

/**
 * Lo que cambió entre el rol guardado y lo escrito. Los espacios de los extremos no cuentan (el
 * backend los quita); una descripción vacía es «sin descripción» (`null`). Sin cambios, `null`.
 */
export function cambiosDeRol(rol: Rol, escritos: DatosRolEscritos): CambiosRol | null {
  const cambios: { nombre?: string; descripcion?: string | null } = {};
  if (escritos.nombre.trim() !== rol.nombre) cambios.nombre = escritos.nombre;
  const descripcion = escritos.descripcion.trim();
  if (descripcion !== (rol.descripcion ?? '')) {
    cambios.descripcion = descripcion === '' ? null : escritos.descripcion;
  }
  return Object.keys(cambios).length === 0 ? null : cambios;
}

/** Cuántos datos cambiaron (para «2 cambios sin guardar»). */
export function cantidadDeCambios(cambios: CambiosRol | null): number {
  return cambios === null ? 0 : Object.keys(cambios).length;
}

/** «1 cambio sin guardar», «2 cambios sin guardar». */
export function textoCambiosSinGuardar(cantidad: number): string {
  return cantidad === 1 ? '1 cambio sin guardar' : `${cantidad} cambios sin guardar`;
}

/** Debajo del nombre en la ficha. */
export function textoUsuariosDelRol(cantidad: number): string {
  if (cantidad === 0) return 'Ningún usuario activo tiene este rol';
  if (cantidad === 1) return '1 usuario activo tiene este rol';
  return `${cantidad} usuarios activos tienen este rol`;
}

/** La columna «Permisos» de la lista: el Administrador, «Todos». */
export function textoPermisosDelRol(rol: RolResumen): string {
  return rol.esAdministrador ? 'Todos' : String(rol.cantidadPermisos);
}

/** La línea de cifras de la tarjeta en el celular: «3 permisos · 1 usuario». */
export function cifrasDelRol(rol: RolResumen): string {
  const permisos = rol.esAdministrador
    ? 'Todos los permisos'
    : rol.cantidadPermisos === 1
      ? '1 permiso'
      : `${rol.cantidadPermisos} permisos`;
  const usuarios = rol.cantidadUsuarios === 1 ? '1 usuario' : `${rol.cantidadUsuarios} usuarios`;
  return `${permisos} · ${usuarios}`;
}

/** Lo que se manda en `POST /roles`: los permisos, en el orden del catálogo. */
export interface NuevoRol {
  readonly nombre: string;
  /** Vacía: sin descripción. */
  readonly descripcion: string | null;
  readonly permisos: readonly string[];
}

/** El alta, de lo escrito: una descripción vacía (o solo espacios) es «sin descripción». */
export function nuevoRol(escritos: DatosRolEscritos, permisos: readonly string[]): NuevoRol {
  return {
    nombre: escritos.nombre,
    descripcion: escritos.descripcion.trim() === '' ? null : escritos.descripcion,
    permisos: [...permisos],
  };
}
