import type { Actor } from '../../../../shared/application/actor.js';
import type { Rol } from '../../domain/entities/rol.entity.js';
import { PermisoDesconocidoError, RolNoEncontradoError } from '../../domain/errors/auth.errors.js';
import type { PoderEnEmpresa, QuienActua } from '../../domain/services/reglas-de-escalada.js';
import type { ConsultarTrazabilidadPort } from '../../../auditoria/application/ports/in/consultar-trazabilidad.port.js';
import type { RolVista } from '../ports/in/consultar-roles.port.js';
import type { PermisosRepositoryPort } from '../ports/out/permisos.repository.port.js';
import type { RolesRepositoryPort } from '../ports/out/roles.repository.port.js';

/** Los repositorios que usan los casos de uso de roles. */
export interface RepositoriosRoles {
  readonly roles: RolesRepositoryPort;
  readonly permisos: PermisosRepositoryPort;
  readonly trazabilidad: ConsultarTrazabilidadPort;
}

/** Lo que piden las reglas contra la escalada (sin el pie de la ficha). */
type RepositoriosPermisos = Pick<RepositoriosRoles, 'roles' | 'permisos'>;

/** Lo que cuenta para el pie de la ficha de un rol (en la bitácora de su empresa). */
export const ACCIONES_ALTA_ROL = ['auth.rol.crear'] as const;
export const ACCIONES_CAMBIO_ROL = [
  'auth.rol.editar',
  'auth.rol.permisos',
  'auth.rol.desactivar',
  'auth.rol.reactivar',
] as const;

/**
 * La empresa activa de quien opera. Sin empresa (no pasa en una petición: el guard la exige),
 * ningún rol existe para él.
 */
export function empresaDe(actor: Actor): string {
  if (actor.empresaId === null) {
    throw new RolNoEncontradoError();
  }
  return actor.empresaId;
}

/** Los permisos vigentes que da el rol: el Administrador, todos (AUTH-D10). */
export function permisosDelRol(rol: Rol, { permisos }: RepositoriosPermisos): Promise<string[]> {
  return rol.esAdministrador ? permisos.codigosVigentes() : permisos.codigosDeRol(rol.id);
}

/** La ficha del rol, leída de la base (dentro de la transacción, si la hay). */
export async function vistaDeRol(rol: Rol, repos: RepositoriosRoles): Promise<RolVista> {
  const [permisos, cantidadUsuarios, traza] = await Promise.all([
    permisosDelRol(rol, repos),
    repos.roles.contarUsuarios(rol.id),
    repos.trazabilidad.de({
      empresaId: rol.empresaId,
      entidad: 'rol',
      entidadId: rol.id,
      accionesAlta: ACCIONES_ALTA_ROL,
      accionesCambio: ACCIONES_CAMBIO_ROL,
    }),
  ]);
  return {
    id: rol.id,
    nombre: rol.nombre.valor,
    descripcion: rol.descripcion,
    esAdministrador: rol.esAdministrador,
    activo: rol.activo,
    permisos,
    cantidadUsuarios,
    creado: traza.creado,
    modificado: traza.modificado,
  };
}

/** Quién hace el cambio, con sus roles **activos** en la empresa activa (para AUTH-D11). */
export async function quienActua(
  actor: Actor,
  empresaId: string,
  repos: RepositoriosPermisos,
): Promise<QuienActua> {
  const usuarioId = actor.usuarioId ?? '';
  return { usuarioId, ...(await poderEnEmpresa(usuarioId, empresaId, repos)) };
}

/** Lo que puede el usuario en esa empresa, con sus roles **activos**. */
export async function poderEnEmpresa(
  usuarioId: string,
  empresaId: string,
  { roles, permisos }: RepositoriosPermisos,
): Promise<PoderEnEmpresa> {
  const [suyos, codigos] = await Promise.all([
    roles.rolesDeUsuario(usuarioId, empresaId),
    permisos.codigosDeUsuario(usuarioId, empresaId),
  ]);
  return {
    esAdministrador: suyos.some((rol) => rol.activo && rol.esAdministrador),
    permisos: codigos,
  };
}

/**
 * Los códigos pedidos, sin repetir y en el orden del catálogo (`vigentes`).
 * `PermisoDesconocidoError` con el primero que no esté entre los vigentes.
 */
export function revisarCodigos(pedidos: readonly string[], vigentes: readonly string[]): string[] {
  const conjunto = new Set(vigentes);
  const desconocido = pedidos.find((codigo) => !conjunto.has(codigo));
  if (desconocido !== undefined) {
    throw new PermisoDesconocidoError(desconocido);
  }
  const pedidosSinRepetir = new Set(pedidos);
  return vigentes.filter((codigo) => pedidosSinRepetir.has(codigo));
}

/** ¿Las dos listas tienen los mismos códigos (sin mirar el orden)? */
export function mismosCodigos(a: readonly string[], b: readonly string[]): boolean {
  const conjunto = new Set(a);
  return conjunto.size === new Set(b).size && b.every((codigo) => conjunto.has(codigo));
}
