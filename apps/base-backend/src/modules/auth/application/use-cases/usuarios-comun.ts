import type { Actor } from '../../../../shared/application/actor.js';
import type { RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import type { ConsultarTrazabilidadPort } from '../../../auditoria/application/ports/in/consultar-trazabilidad.port.js';
import type { ConsultarEmpresasPort } from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import type { Rol } from '../../domain/entities/rol.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import type { PERMISOS_AUTH } from '../../auth.permisos.js';
import { ContrasenaDebilError, UsuarioNoEncontradoError } from '../../domain/errors/auth.errors.js';
import { ReglasDeEscalada } from '../../domain/services/reglas-de-escalada.js';
import { Contrasena } from '../../domain/value-objects/contrasena.vo.js';
import type { NombreUsuario } from '../../domain/value-objects/nombre-usuario.vo.js';
import type { RolDeUsuarioVista, UsuarioVista } from '../ports/in/consultar-usuarios.port.js';
import type { ContrasenasComunesPort } from '../ports/out/contrasenas-comunes.port.js';
import type { GeneradorContrasenaTemporalPort } from '../ports/out/generador-contrasena-temporal.port.js';
import type { OpcionesSesion } from '../ports/out/opciones-sesion.port.js';
import type { PermisosRepositoryPort } from '../ports/out/permisos.repository.port.js';
import type { RolesRepositoryPort } from '../ports/out/roles.repository.port.js';
import type { SesionesRepositoryPort } from '../ports/out/sesiones.repository.port.js';
import type { UsuariosRepositoryPort } from '../ports/out/usuarios.repository.port.js';

/** Lo que usan los casos de uso de usuarios para armar la ficha. */
export interface DependenciasFichaUsuario {
  readonly usuarios: UsuariosRepositoryPort;
  readonly roles: RolesRepositoryPort;
  readonly sesiones: SesionesRepositoryPort;
  readonly empresas: ConsultarEmpresasPort;
  readonly reloj: RelojPort;
  readonly opciones: OpcionesSesion;
  readonly trazabilidad: ConsultarTrazabilidadPort;
}

/**
 * Lo que cuenta para el pie de la ficha de un usuario (en la bitácora de la empresa activa). No
 * cuentan los ingresos, los intentos fallidos ni el bloqueo que pone el sistema (decisión del
 * usuario, 6.12a0).
 */
export const ACCIONES_ALTA_USUARIO = ['auth.usuario.crear', 'auth.usuario.dar_acceso'] as const;
export const ACCIONES_CAMBIO_USUARIO = [
  'auth.usuario.editar',
  'auth.usuario.asignar_roles',
  'auth.usuario.contrasena_temporal',
  'auth.usuario.desbloquear',
  'auth.usuario.cerrar_sesiones',
  'auth.usuario.desactivar',
  'auth.usuario.reactivar',
  'auth.usuario.cambiar_contrasena',
] as const;

/**
 * La empresa activa de quien opera. Sin empresa (no pasa en una petición: el guard la exige),
 * ningún usuario existe para él.
 */
export function empresaDeQuienOpera(actor: Actor): string {
  if (actor.empresaId === null) {
    throw new UsuarioNoEncontradoError();
  }
  return actor.empresaId;
}

/**
 * Las empresas **activas** donde el usuario tiene algún rol, activo o no (AUTH-D12, decisión del
 * usuario en el 6.7c): en una desactivada nadie entra, y si contara, lo de la persona no se
 * podría cambiar nunca más.
 */
export async function empresasActivasDelUsuario(
  usuarioId: string,
  { roles, empresas }: Pick<DependenciasFichaUsuario, 'roles' | 'empresas'>,
): Promise<string[]> {
  const ids = await roles.empresasConRol(usuarioId);
  if (ids.length === 0) {
    return [];
  }
  return (await empresas.nombres(ids)).filter((e) => e.activo).map((e) => e.id);
}

/**
 * El usuario, con su fila bloqueada (`FOR UPDATE`: dos cambios a la vez dejan bien el «antes» de
 * la bitácora), y sus roles en la empresa. `UsuarioNoEncontradoError` si no existe o no tiene
 * ningún rol en ella.
 */
export async function bloquearUsuarioDeEmpresa(
  id: string,
  empresaId: string,
  { usuarios, roles }: Pick<DependenciasFichaUsuario, 'usuarios' | 'roles'>,
): Promise<{ usuario: Usuario; roles: Rol[] }> {
  const usuario = await usuarios.buscarParaActualizar(id);
  const suyos = usuario === null ? [] : await roles.rolesDeUsuario(usuario.id, empresaId);
  if (usuario === null || suyos.length === 0) {
    throw new UsuarioNoEncontradoError();
  }
  return { usuario, roles: suyos };
}

/**
 * AUTH-D12: lo que es de la persona lo hace solo quien tiene ese permiso en todas las empresas
 * activas del usuario (`UsuarioDeOtraEmpresaError`).
 */
export async function revisarCambioDePersona(
  usuarioId: string,
  permiso: keyof typeof PERMISOS_AUTH,
  actor: Actor,
  deps: Pick<DependenciasFichaUsuario, 'roles' | 'empresas'> & {
    readonly permisos: PermisosRepositoryPort;
  },
): Promise<void> {
  const [empresasDelUsuario, empresasDondePuede] = await Promise.all([
    empresasActivasDelUsuario(usuarioId, deps),
    deps.permisos.empresasConPermiso(actor.usuarioId ?? '', permiso),
  ]);
  ReglasDeEscalada.revisarCambioDePersona({ empresasDelUsuario, empresasDondePuede });
}

/**
 * Intentos de generar una temporal que pase `Contrasena` (una común o trivial de 12 caracteres
 * al azar casi no sale: con 5 intentos, no pasa nunca).
 */
const INTENTOS_CONTRASENA_TEMPORAL = 5;

/** Lo que hace falta para generar una contraseña temporal (AUTH-D13). */
export interface DependenciasContrasenaTemporal {
  readonly empresas: ConsultarEmpresasPort;
  readonly generador: GeneradorContrasenaTemporalPort;
  readonly comunes: ContrasenasComunesPort;
}

/**
 * Una temporal que cumple las reglas de `Contrasena` para este usuario (no contiene su nombre
 * ni el de sus empresas, no es común ni trivial). Al azar casi siempre pasa al primer intento.
 * Va fuera de la transacción (con el hash, es lo que tarda).
 */
export async function generarContrasenaTemporal(
  nombre: NombreUsuario,
  empresaIds: readonly string[],
  { empresas, generador, comunes }: DependenciasContrasenaTemporal,
): Promise<Contrasena> {
  const nombresEmpresas =
    empresaIds.length === 0 ? [] : (await empresas.nombres(empresaIds)).map((e) => e.nombre);
  let ultimoError: ContrasenaDebilError | null = null;
  for (let intento = 0; intento < INTENTOS_CONTRASENA_TEMPORAL; intento++) {
    try {
      return Contrasena.crear(generador.generar(), {
        nombreUsuario: nombre.valor,
        nombresEmpresas,
        esComun: (texto) => comunes.esComun(texto),
      });
    } catch (error) {
      if (!(error instanceof ContrasenaDebilError)) {
        throw error;
      }
      ultimoError = error;
    }
  }
  // No pasa con un generador al azar: sería un error de programación (→ 500).
  throw new Error('No se pudo generar una contraseña temporal válida', { cause: ultimoError });
}

/** Hasta cuándo está bloqueado, solo si lo está ahora. */
export function bloqueoVigente(bloqueadoHasta: Date | null, ahora: Date): Date | null {
  return bloqueadoHasta !== null && ahora.getTime() < bloqueadoHasta.getTime()
    ? bloqueadoHasta
    : null;
}

export function vistaDeRolDeUsuario(rol: Rol): RolDeUsuarioVista {
  return {
    id: rol.id,
    nombre: rol.nombre.valor,
    esAdministrador: rol.esAdministrador,
    activo: rol.activo,
  };
}

/**
 * La ficha del usuario vista desde la empresa: `rolesEnEmpresa` son sus roles en ella (ya
 * leídos: quien llama los necesitó para saber si el usuario es de la empresa).
 */
export async function vistaDeUsuario(
  usuario: Usuario,
  rolesEnEmpresa: readonly Rol[],
  empresaId: string,
  deps: DependenciasFichaUsuario,
): Promise<UsuarioVista> {
  const ahora = deps.reloj.ahora();
  const [empresasDelUsuario, abiertas, traza] = await Promise.all([
    empresasActivasDelUsuario(usuario.id, deps),
    deps.sesiones.abiertasDeUsuarioEnEmpresa(usuario.id, empresaId),
    deps.trazabilidad.de({
      empresaId,
      entidad: 'usuario',
      entidadId: usuario.id,
      accionesAlta: ACCIONES_ALTA_USUARIO,
      accionesCambio: ACCIONES_CAMBIO_USUARIO,
    }),
  ]);
  return {
    id: usuario.id,
    nombreUsuario: usuario.nombreUsuario.valor,
    nombreCompleto: usuario.nombreCompleto.valor,
    activo: usuario.activo,
    bloqueadoHasta: bloqueoVigente(usuario.bloqueadoHasta, ahora),
    ultimoIngresoEn: usuario.ultimoIngresoEn,
    roles: [...rolesEnEmpresa].map(vistaDeRolDeUsuario),
    debeCambiarContrasena: usuario.debeCambiarContrasena,
    trabajaEnOtrasEmpresas: empresasDelUsuario.some((id) => id !== empresaId),
    sesiones: abiertas
      .filter((sesion) => sesion.estaViva(ahora, deps.opciones.inactividadMinutos))
      .map((sesion) => {
        const d = sesion.datos();
        return {
          id: d.id,
          iniciadaEn: d.iniciadaEn,
          ultimoUsoEn: d.ultimoUsoEn,
          ip: d.ip,
          navegador: d.navegador,
        };
      }),
    creado: traza.creado,
    modificado: traza.modificado,
  };
}
