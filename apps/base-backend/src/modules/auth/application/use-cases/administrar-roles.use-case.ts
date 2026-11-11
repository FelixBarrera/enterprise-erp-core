import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTAR_TRAZABILIDAD_PORT,
  type ConsultarTrazabilidadPort,
} from '../../../auditoria/application/ports/in/consultar-trazabilidad.port.js';
import type { Actor } from '../../../../shared/application/actor.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../../../../shared/application/ports/unidad-de-trabajo.port.js';
import {
  REGISTRAR_AUDITORIA_PORT,
  type RegistrarAuditoriaPort,
} from '../../../auditoria/application/ports/in/registrar-auditoria.port.js';
import type { Rol } from '../../domain/entities/rol.entity.js';
import {
  RolAdministradorFijoError,
  RolNoEncontradoError,
} from '../../domain/errors/auth.errors.js';
import { ReglasDeEscalada } from '../../domain/services/reglas-de-escalada.js';
import { descripcionRol, NombreRol } from '../../domain/value-objects/nombre-rol.vo.js';
import type {
  AdministrarRolesPort,
  CrearRolComando,
  EditarRolComando,
} from '../ports/in/administrar-roles.port.js';
import type { RolVista } from '../ports/in/consultar-roles.port.js';
import {
  PERMISOS_REPOSITORY_PORT,
  type PermisosRepositoryPort,
} from '../ports/out/permisos.repository.port.js';
import {
  ROLES_REPOSITORY_PORT,
  type RolesRepositoryPort,
} from '../ports/out/roles.repository.port.js';
import {
  empresaDe,
  mismosCodigos,
  quienActua,
  type RepositoriosRoles,
  revisarCodigos,
  vistaDeRol,
} from './roles-comun.js';

const ENTIDAD = 'rol';

/**
 * Crear, editar, fijar permisos, desactivar y reactivar roles de la empresa activa. Lo que se
 * puede revisar sin la base (nombre, descripción) se revisa antes de abrir la transacción; lo
 * demás, con la fila del rol bloqueada, para que dos cambios a la vez dejen bien el «antes» de
 * la bitácora.
 */
@Injectable()
export class AdministrarRolesUseCase implements AdministrarRolesPort {
  private readonly repos: RepositoriosRoles;

  constructor(
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(PERMISOS_REPOSITORY_PORT) private readonly permisos: PermisosRepositoryPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
    @Inject(CONSULTAR_TRAZABILIDAD_PORT) trazabilidad: ConsultarTrazabilidadPort,
  ) {
    this.repos = { roles, permisos, trazabilidad };
  }

  async crear(comando: CrearRolComando, actor: Actor): Promise<RolVista> {
    const empresaId = empresaDe(actor);
    const nombre = NombreRol.crear(comando.nombre);
    const descripcion = descripcionRol(comando.descripcion ?? null);
    const pedidos = comando.permisos ?? [];
    return this.unidad.ejecutar(async () => {
      const codigos = revisarCodigos(pedidos, await this.permisos.codigosVigentes());
      const quien = await quienActua(actor, empresaId, this.repos);
      // Un rol nuevo no tiene permisos: todos los pedidos se «agregan» (AUTH-D11 (2)).
      ReglasDeEscalada.revisarCambioDePermisosDeRol({
        quien,
        rol: { id: '', esAdministrador: false, permisos: [] },
        nuevos: codigos,
      });
      const rol = await this.roles.crear(
        { empresaId, nombre, descripcion, esAdministrador: false },
        actor.usuarioId,
      );
      if (codigos.length > 0) {
        await this.permisos.fijarDeRol(rol.id, codigos, actor.usuarioId);
      }
      await this.auditoria.registrar(
        {
          accion: 'auth.rol.crear',
          entidad: ENTIDAD,
          entidadId: rol.id,
          entidadNombre: rol.nombre.valor,
          despues: { nombre: rol.nombre.valor, descripcion: rol.descripcion, permisos: codigos },
        },
        actor,
      );
      return vistaDeRol(rol, this.repos);
    });
  }

  async editar(id: string, comando: EditarRolComando, actor: Actor): Promise<RolVista> {
    const empresaId = empresaDe(actor);
    const nombre = comando.nombre === undefined ? undefined : NombreRol.crear(comando.nombre);
    const descripcion =
      comando.descripcion === undefined ? undefined : descripcionRol(comando.descripcion);
    return this.unidad.ejecutar(async () => {
      const rol = await this.bloquearEditable(id, empresaId);
      const editado = rol.editar(
        nombre ?? rol.nombre,
        descripcion === undefined ? rol.descripcion : descripcion,
      );
      if (editado.nombre.valor === rol.nombre.valor && editado.descripcion === rol.descripcion) {
        return vistaDeRol(rol, this.repos);
      }
      await this.roles.guardar(editado, actor.usuarioId);
      await this.auditoria.registrar(
        {
          accion: 'auth.rol.editar',
          entidad: ENTIDAD,
          entidadId: rol.id,
          entidadNombre: editado.nombre.valor,
          antes: { nombre: rol.nombre.valor, descripcion: rol.descripcion },
          despues: { nombre: editado.nombre.valor, descripcion: editado.descripcion },
        },
        actor,
      );
      return vistaDeRol(editado, this.repos);
    });
  }

  async fijarPermisos(id: string, pedidos: readonly string[], actor: Actor): Promise<RolVista> {
    const empresaId = empresaDe(actor);
    return this.unidad.ejecutar(async () => {
      const rol = await this.bloquearEditable(id, empresaId);
      const codigos = revisarCodigos(pedidos, await this.permisos.codigosVigentes());
      const actuales = await this.permisos.codigosDeRol(rol.id);
      ReglasDeEscalada.revisarCambioDePermisosDeRol({
        quien: await quienActua(actor, empresaId, this.repos),
        rol: { id: rol.id, esAdministrador: rol.esAdministrador, permisos: actuales },
        nuevos: codigos,
      });
      if (mismosCodigos(actuales, codigos)) {
        return vistaDeRol(rol, this.repos);
      }
      await this.permisos.fijarDeRol(rol.id, codigos, actor.usuarioId);
      await this.auditoria.registrar(
        {
          accion: 'auth.rol.permisos',
          entidad: ENTIDAD,
          entidadId: rol.id,
          entidadNombre: rol.nombre.valor,
          antes: { permisos: actuales },
          despues: { permisos: codigos },
        },
        actor,
      );
      return vistaDeRol(rol, this.repos);
    });
  }

  async desactivar(id: string, actor: Actor): Promise<RolVista> {
    const empresaId = empresaDe(actor);
    return this.unidad.ejecutar(async () => {
      const rol = await this.bloquearEditable(id, empresaId);
      if (!rol.activo) {
        return vistaDeRol(rol, this.repos);
      }
      return this.cambiarActivo(rol, rol.desactivar(), 'auth.rol.desactivar', actor);
    });
  }

  async reactivar(id: string, actor: Actor): Promise<RolVista> {
    const empresaId = empresaDe(actor);
    return this.unidad.ejecutar(async () => {
      const rol = await this.bloquearEditable(id, empresaId);
      if (rol.activo) {
        return vistaDeRol(rol, this.repos);
      }
      ReglasDeEscalada.revisarReactivacionDeRol({
        quien: await quienActua(actor, empresaId, this.repos),
        rol: {
          id: rol.id,
          esAdministrador: rol.esAdministrador,
          permisos: await this.permisos.codigosDeRol(rol.id),
        },
      });
      return this.cambiarActivo(rol, rol.reactivar(), 'auth.rol.reactivar', actor);
    });
  }

  /**
   * El rol de la empresa activa, con su fila bloqueada. `RolNoEncontradoError` si no es de esta
   * empresa; `RolAdministradorFijoError` si es el Administrador (AUTH-D10: no se cambia nada de
   * él, ni aunque el cambio no cambie nada, para que la pantalla lo sepa siempre igual).
   */
  private async bloquearEditable(id: string, empresaId: string): Promise<Rol> {
    const rol = await this.roles.buscarParaActualizar(id, empresaId);
    if (rol === null) {
      throw new RolNoEncontradoError();
    }
    if (rol.esAdministrador) {
      throw new RolAdministradorFijoError();
    }
    return rol;
  }

  private async cambiarActivo(
    rol: Rol,
    cambiado: Rol,
    accion: 'auth.rol.desactivar' | 'auth.rol.reactivar',
    actor: Actor,
  ): Promise<RolVista> {
    await this.roles.guardar(cambiado, actor.usuarioId);
    await this.auditoria.registrar(
      {
        accion,
        entidad: ENTIDAD,
        entidadId: rol.id,
        entidadNombre: rol.nombre.valor,
        antes: { activo: rol.activo },
        despues: { activo: cambiado.activo },
      },
      actor,
    );
    return vistaDeRol(cambiado, this.repos);
  }
}
