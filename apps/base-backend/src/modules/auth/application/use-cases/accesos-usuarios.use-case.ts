import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTAR_TRAZABILIDAD_PORT,
  type ConsultarTrazabilidadPort,
} from '../../../auditoria/application/ports/in/consultar-trazabilidad.port.js';
import type { Actor } from '../../../../shared/application/actor.js';
import { RELOJ_PORT, type RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../../../../shared/application/ports/unidad-de-trabajo.port.js';
import {
  REGISTRAR_AUDITORIA_PORT,
  type RegistrarAuditoriaPort,
} from '../../../auditoria/application/ports/in/registrar-auditoria.port.js';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
} from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import type { Rol } from '../../domain/entities/rol.entity.js';
import { MotivoCierreSesion } from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  RolDesactivadoError,
  RolDesconocidoError,
  SinRolesError,
} from '../../domain/errors/auth.errors.js';
import { ReglasDeEscalada, type RolConPermisos } from '../../domain/services/reglas-de-escalada.js';
import { NombreCompleto } from '../../domain/value-objects/nombre-completo.vo.js';
import { NombreUsuario } from '../../domain/value-objects/nombre-usuario.vo.js';
import type {
  AccesoQuitado,
  AccesosUsuariosPort,
  CrearUsuarioComando,
  UsuarioCreado,
} from '../ports/in/accesos-usuarios.port.js';
import type { UsuarioVista } from '../ports/in/consultar-usuarios.port.js';
import {
  CONTRASENAS_COMUNES_PORT,
  type ContrasenasComunesPort,
} from '../ports/out/contrasenas-comunes.port.js';
import {
  GENERADOR_CONTRASENA_TEMPORAL_PORT,
  type GeneradorContrasenaTemporalPort,
} from '../ports/out/generador-contrasena-temporal.port.js';
import {
  HASHER_CONTRASENA_PORT,
  type HasherContrasenaPort,
} from '../ports/out/hasher-contrasena.port.js';
import { OPCIONES_SESION, type OpcionesSesion } from '../ports/out/opciones-sesion.port.js';
import {
  PERMISOS_REPOSITORY_PORT,
  type PermisosRepositoryPort,
} from '../ports/out/permisos.repository.port.js';
import {
  ROLES_REPOSITORY_PORT,
  type RolesRepositoryPort,
} from '../ports/out/roles.repository.port.js';
import {
  SESIONES_REPOSITORY_PORT,
  type SesionesRepositoryPort,
} from '../ports/out/sesiones.repository.port.js';
import {
  USUARIOS_REPOSITORY_PORT,
  type UsuariosRepositoryPort,
} from '../ports/out/usuarios.repository.port.js';
import { quienActua } from './roles-comun.js';
import {
  bloquearUsuarioDeEmpresa,
  type DependenciasFichaUsuario,
  empresaDeQuienOpera,
  generarContrasenaTemporal,
  vistaDeUsuario,
} from './usuarios-comun.js';

const ENTIDAD = 'usuario';
const SIN_ROLES_AL_CREAR = 'Debe elegir al menos un rol';
const SIN_ROLES_AL_FIJAR = 'Para quitarle todos los roles use Quitar acceso';

/**
 * Quién entra a la empresa activa y con qué roles (AUTH-D11, AUTH-D12: es de la empresa). Lo que
 * se puede revisar sin la base (nombres, la contraseña temporal y su hash) va antes de abrir la
 * transacción; lo demás, con la fila del usuario bloqueada.
 */
@Injectable()
export class AccesosUsuariosUseCase implements AccesosUsuariosPort {
  private readonly deps: DependenciasFichaUsuario;

  constructor(
    @Inject(USUARIOS_REPOSITORY_PORT) private readonly usuarios: UsuariosRepositoryPort,
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(PERMISOS_REPOSITORY_PORT) private readonly permisos: PermisosRepositoryPort,
    @Inject(SESIONES_REPOSITORY_PORT) private readonly sesiones: SesionesRepositoryPort,
    @Inject(CONSULTAR_EMPRESAS_PORT) private readonly empresas: ConsultarEmpresasPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
    @Inject(OPCIONES_SESION) opciones: OpcionesSesion,
    @Inject(HASHER_CONTRASENA_PORT) private readonly hasher: HasherContrasenaPort,
    @Inject(CONTRASENAS_COMUNES_PORT) private readonly comunes: ContrasenasComunesPort,
    @Inject(GENERADOR_CONTRASENA_TEMPORAL_PORT)
    private readonly generador: GeneradorContrasenaTemporalPort,
    @Inject(CONSULTAR_TRAZABILIDAD_PORT) trazabilidad: ConsultarTrazabilidadPort,
  ) {
    this.deps = { usuarios, roles, sesiones, empresas, reloj, opciones, trazabilidad };
  }

  async crear(comando: CrearUsuarioComando, actor: Actor): Promise<UsuarioCreado> {
    const empresaId = empresaDeQuienOpera(actor);
    const nombreUsuario = NombreUsuario.crear(comando.nombreUsuario);
    const nombreCompleto = NombreCompleto.crear(comando.nombreCompleto);
    const pedidos = rolesPedidos(comando.roles, SIN_ROLES_AL_CREAR);
    // Generar y calcular el hash tarda: fuera de la transacción.
    const contrasenaTemporal = await generarContrasenaTemporal(nombreUsuario, [empresaId], {
      empresas: this.empresas,
      generador: this.generador,
      comunes: this.comunes,
    });
    const hash = await this.hasher.calcularHash(contrasenaTemporal);

    return this.unidad.ejecutar(async () => {
      const nuevos = await this.rolesParaDar(pedidos, [], empresaId);
      const usuario = await this.usuarios.crear(
        { nombreUsuario, nombreCompleto, hashContrasena: hash, debeCambiarContrasena: true },
        actor.usuarioId,
      );
      await this.revisarEscalada(actor, empresaId, usuario.id, [], nuevos);
      await this.roles.fijarDeUsuario(usuario.id, empresaId, idsDe(nuevos), actor.usuarioId);
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.crear',
          entidad: ENTIDAD,
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          despues: {
            nombreUsuario: usuario.nombreUsuario.valor,
            nombreCompleto: usuario.nombreCompleto.valor,
            // La bitácora oculta todo campo que contenga "contrasena": este dato no es secreto.
            claveTemporal: true,
            activo: true,
            roles: nombresDe(nuevos),
          },
        },
        actor,
      );
      return {
        usuario: await this.fichaActual(usuario, empresaId),
        contrasenaTemporal: contrasenaTemporal.valor,
      };
    });
  }

  async fijarRoles(id: string, roles: readonly string[], actor: Actor): Promise<UsuarioVista> {
    const empresaId = empresaDeQuienOpera(actor);
    const pedidos = rolesPedidos(roles, SIN_ROLES_AL_FIJAR);

    return this.unidad.ejecutar(async () => {
      const { usuario, roles: actuales } = await bloquearUsuarioDeEmpresa(id, empresaId, this.deps);
      const nuevos = await this.rolesParaDar(pedidos, actuales, empresaId);
      // AUTH-D11 siempre, aunque nada cambie: la pantalla lo sabe siempre igual.
      await this.revisarEscalada(actor, empresaId, usuario.id, actuales, nuevos);
      await this.revisarQueQuedeAdministrador(usuario, actuales, nuevos, empresaId);
      if (mismosRoles(actuales, nuevos)) {
        return vistaDeUsuario(usuario, actuales, empresaId, this.deps);
      }
      await this.roles.fijarDeUsuario(usuario.id, empresaId, idsDe(nuevos), actor.usuarioId);
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.asignar_roles',
          entidad: ENTIDAD,
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          antes: { roles: nombresDe(actuales) },
          despues: { roles: nombresDe(nuevos) },
        },
        actor,
      );
      return this.fichaActual(usuario, empresaId);
    });
  }

  async quitarAcceso(id: string, actor: Actor): Promise<AccesoQuitado> {
    const empresaId = empresaDeQuienOpera(actor);

    return this.unidad.ejecutar(async () => {
      const { usuario, roles: actuales } = await bloquearUsuarioDeEmpresa(id, empresaId, this.deps);
      await this.revisarEscalada(actor, empresaId, usuario.id, actuales, []);
      await this.revisarQueQuedeAdministrador(usuario, actuales, [], empresaId);
      await this.roles.fijarDeUsuario(usuario.id, empresaId, [], actor.usuarioId);
      const sesionesCerradas = await this.sesiones.cerrarTodasDelUsuarioEnEmpresa(
        usuario.id,
        empresaId,
        MotivoCierreSesion.ACCESO_QUITADO,
        this.reloj.ahora(),
      );
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.quitar_acceso',
          entidad: ENTIDAD,
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          antes: { roles: nombresDe(actuales) },
          despues: { roles: [], sesionesCerradas },
        },
        actor,
      );
      return { id: usuario.id, sesionesCerradas };
    });
  }

  /**
   * Los roles pedidos, de la empresa activa. `RolDesconocidoError` si alguno no es de ella;
   * `RolDesactivadoError` si alguno está desactivado y no lo tenía ya (decisión del usuario, 6.7d).
   */
  private async rolesParaDar(
    pedidos: readonly string[],
    actuales: readonly Rol[],
    empresaId: string,
  ): Promise<Rol[]> {
    const encontrados = await this.roles.buscarVarios(pedidos, empresaId);
    if (encontrados.length !== pedidos.length) {
      throw new RolDesconocidoError();
    }
    const yaLosTiene = new Set(idsDe(actuales));
    if (encontrados.some((rol) => !rol.activo && !yaLosTiene.has(rol.id))) {
      throw new RolDesactivadoError();
    }
    return ordenados(encontrados);
  }

  /** AUTH-D11 (1), (2) y (3), con los permisos que da cada rol (el Administrador, todos). */
  private async revisarEscalada(
    actor: Actor,
    empresaId: string,
    usuarioId: string,
    actuales: readonly Rol[],
    nuevos: readonly Rol[],
  ): Promise<void> {
    const todos = [...actuales, ...nuevos];
    const [quien, porRol, vigentes] = await Promise.all([
      quienActua(actor, empresaId, { roles: this.roles, permisos: this.permisos }),
      this.permisos.codigosDeRoles(idsDe(todos)),
      todos.some((rol) => rol.esAdministrador)
        ? this.permisos.codigosVigentes()
        : Promise.resolve([]),
    ]);
    const conPermisos = (rol: Rol): RolConPermisos => ({
      id: rol.id,
      esAdministrador: rol.esAdministrador,
      permisos: rol.esAdministrador ? vigentes : (porRol.get(rol.id) ?? []),
    });
    ReglasDeEscalada.revisarCambioDeRoles({
      quien,
      usuarioId,
      actuales: actuales.map(conPermisos),
      nuevos: nuevos.map(conPermisos),
    });
  }

  /**
   * AUTH-D11 (4): si le quita el rol Administrador a un usuario activo, tiene que quedar otro
   * administrador activo. Bloquea la fila del rol Administrador antes de contar: dos que se
   * quitan el rol uno al otro a la vez no dejan a la empresa sin ninguno.
   */
  private async revisarQueQuedeAdministrador(
    usuario: Usuario,
    actuales: readonly Rol[],
    nuevos: readonly Rol[],
    empresaId: string,
  ): Promise<void> {
    const administrador = actuales.find((rol) => rol.esAdministrador);
    if (
      administrador === undefined ||
      !usuario.activo ||
      nuevos.some((rol) => rol.id === administrador.id)
    ) {
      return;
    }
    await this.roles.buscarParaActualizar(administrador.id, empresaId);
    const activos = await this.roles.contarUsuarios(administrador.id);
    ReglasDeEscalada.revisarQueQuedeAdministrador(activos - 1);
  }

  /** La ficha con sus roles de ahora (leídos de nuevo, dentro de la transacción). */
  private async fichaActual(usuario: Usuario, empresaId: string): Promise<UsuarioVista> {
    const suyos = await this.roles.rolesDeUsuario(usuario.id, empresaId);
    return vistaDeUsuario(usuario, suyos, empresaId, this.deps);
  }
}

/** Los ids pedidos sin repetir; `SinRolesError` con ese mensaje si no hay ninguno. */
function rolesPedidos(roles: readonly string[], mensajeSinRoles: string): string[] {
  const sinRepetir = [...new Set(roles)];
  if (sinRepetir.length === 0) {
    throw new SinRolesError(mensajeSinRoles);
  }
  return sinRepetir;
}

function idsDe(roles: readonly Rol[]): string[] {
  return roles.map((rol) => rol.id);
}

/** Por nombre: así la bitácora guarda la lista siempre en el mismo orden. */
function ordenados(roles: readonly Rol[]): Rol[] {
  return [...roles].sort(
    (a, b) => a.nombre.valor.localeCompare(b.nombre.valor, 'es') || a.id.localeCompare(b.id),
  );
}

function nombresDe(roles: readonly Rol[]): string[] {
  return ordenados(roles).map((rol) => rol.nombre.valor);
}

function mismosRoles(a: readonly Rol[], b: readonly Rol[]): boolean {
  const ids = new Set(idsDe(a));
  return ids.size === b.length && b.every((rol) => ids.has(rol.id));
}
