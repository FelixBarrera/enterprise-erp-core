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
import type { PERMISOS_AUTH } from '../../auth.permisos.js';
import { MotivoCierreSesion } from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  EscaladaError,
  UsuarioInactivoError,
  UsuarioNoEncontradoError,
} from '../../domain/errors/auth.errors.js';
import { ReglasDeEscalada } from '../../domain/services/reglas-de-escalada.js';
import type {
  AccionesUsuariosPort,
  ContrasenaTemporalDada,
  SesionesCerradas,
} from '../ports/in/acciones-usuarios.port.js';
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
import { poderEnEmpresa } from './roles-comun.js';
import {
  bloquearUsuarioDeEmpresa,
  type DependenciasFichaUsuario,
  empresaDeQuienOpera,
  empresasActivasDelUsuario,
  generarContrasenaTemporal,
  revisarCambioDePersona,
  vistaDeUsuario,
} from './usuarios-comun.js';

const ENTIDAD = 'usuario';

/**
 * Acciones sobre la persona desde su ficha (docs/modulos/auth-usuarios.md, sección 6). Todas
 * bloquean la fila del usuario: dos acciones a la vez dejan bien el «antes» de la bitácora.
 */
@Injectable()
export class AccionesUsuariosUseCase implements AccionesUsuariosPort {
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

  async darContrasenaTemporal(id: string, actor: Actor): Promise<ContrasenaTemporalDada> {
    const empresaId = empresaDeQuienOpera(actor);
    if (actor.usuarioId === id) {
      throw new EscaladaError('propia_contrasena');
    }
    // Generar y calcular el hash tarda: fuera de la transacción. El nombre de usuario no cambia;
    // todo lo demás se revisa de nuevo con la fila bloqueada.
    const previo = await this.usuarios.buscarPorId(id);
    if (previo === null) {
      throw new UsuarioNoEncontradoError();
    }
    const contrasenaTemporal = await generarContrasenaTemporal(
      previo.nombreUsuario,
      await this.roles.empresasConRol(previo.id),
      { empresas: this.empresas, generador: this.generador, comunes: this.comunes },
    );
    const hash = await this.hasher.calcularHash(contrasenaTemporal);

    return this.unidad.ejecutar(async () => {
      const { usuario, roles } = await bloquearUsuarioDeEmpresa(id, empresaId, this.deps);
      if (!usuario.activo) {
        throw new UsuarioInactivoError(usuario.nombreUsuario.valor);
      }
      await this.revisarSobrePersona(usuario, 'auth.usuario.restablecer', true, actor);
      const nuevo = usuario.cambiarContrasena(hash, true).desbloquear();
      await this.usuarios.guardar(nuevo, actor.usuarioId);
      const sesionesCerradas = await this.sesiones.cerrarTodasDelUsuario(
        usuario.id,
        MotivoCierreSesion.ADMINISTRADOR,
        this.reloj.ahora(),
      );
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.contrasena_temporal',
          entidad: ENTIDAD,
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          // La bitácora oculta todo campo que contenga "contrasena": este dato no es secreto.
          despues: { claveTemporal: true, sesionesCerradas },
        },
        actor,
      );
      return {
        usuario: await vistaDeUsuario(nuevo, roles, empresaId, this.deps),
        contrasenaTemporal: contrasenaTemporal.valor,
      };
    });
  }

  async desbloquear(id: string, actor: Actor): Promise<UsuarioVista> {
    const empresaId = empresaDeQuienOpera(actor);

    return this.unidad.ejecutar(async () => {
      const { usuario, roles } = await bloquearUsuarioDeEmpresa(id, empresaId, this.deps);
      const ahora = this.reloj.ahora();
      if (!usuario.estaBloqueado(ahora) && usuario.intentosFallidos === 0) {
        return vistaDeUsuario(usuario, roles, empresaId, this.deps);
      }
      const nuevo = usuario.desbloquear();
      await this.usuarios.guardar(nuevo, actor.usuarioId);
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.desbloquear',
          entidad: ENTIDAD,
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          antes: {
            bloqueadoHasta: usuario.estaBloqueado(ahora) ? usuario.bloqueadoHasta : null,
            intentosFallidos: usuario.intentosFallidos,
          },
          despues: { bloqueadoHasta: null, intentosFallidos: 0 },
        },
        actor,
      );
      return vistaDeUsuario(nuevo, roles, empresaId, this.deps);
    });
  }

  async cerrarSesiones(
    id: string,
    sesionActualId: string,
    actor: Actor,
  ): Promise<SesionesCerradas> {
    const empresaId = empresaDeQuienOpera(actor);

    return this.unidad.ejecutar(async () => {
      const { usuario } = await bloquearUsuarioDeEmpresa(id, empresaId, this.deps);
      const ahora = this.reloj.ahora();
      const motivo = MotivoCierreSesion.ADMINISTRADOR;
      // Sobre uno mismo, la sesión desde la que lo pide sigue (decisión del usuario, 6.7e).
      const sesionesCerradas =
        actor.usuarioId === usuario.id
          ? await this.sesiones.cerrarOtrasDelUsuario(usuario.id, sesionActualId, motivo, ahora)
          : await this.sesiones.cerrarTodasDelUsuario(usuario.id, motivo, ahora);
      if (sesionesCerradas > 0) {
        await this.auditoria.registrar(
          {
            accion: 'auth.usuario.cerrar_sesiones',
            entidad: ENTIDAD,
            entidadId: usuario.id,
            entidadNombre: usuario.nombreUsuario.valor,
            despues: { sesionesCerradas },
          },
          actor,
        );
      }
      return { id: usuario.id, sesionesCerradas };
    });
  }

  async desactivar(id: string, actor: Actor): Promise<UsuarioVista> {
    const empresaId = empresaDeQuienOpera(actor);
    if (actor.usuarioId === id) {
      throw new EscaladaError('desactivarse');
    }

    return this.unidad.ejecutar(async () => {
      const { usuario, roles } = await bloquearUsuarioDeEmpresa(id, empresaId, this.deps);
      const empresas = await this.revisarSobrePersona(
        usuario,
        'auth.usuario.desactivar',
        false,
        actor,
      );
      if (!usuario.activo) {
        return vistaDeUsuario(usuario, roles, empresaId, this.deps);
      }
      await this.revisarQueQuedenAdministradores(usuario, empresas);
      const nuevo = usuario.desactivar();
      await this.usuarios.guardar(nuevo, actor.usuarioId);
      const sesionesCerradas = await this.sesiones.cerrarTodasDelUsuario(
        usuario.id,
        MotivoCierreSesion.USUARIO_DESACTIVADO,
        this.reloj.ahora(),
      );
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.desactivar',
          entidad: ENTIDAD,
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          antes: { activo: true },
          despues: { activo: false, sesionesCerradas },
        },
        actor,
      );
      return vistaDeUsuario(nuevo, roles, empresaId, this.deps);
    });
  }

  async reactivar(id: string, actor: Actor): Promise<UsuarioVista> {
    const empresaId = empresaDeQuienOpera(actor);

    return this.unidad.ejecutar(async () => {
      const { usuario, roles } = await bloquearUsuarioDeEmpresa(id, empresaId, this.deps);
      await this.revisarSobrePersona(usuario, 'auth.usuario.desactivar', true, actor);
      if (usuario.activo) {
        return vistaDeUsuario(usuario, roles, empresaId, this.deps);
      }
      const nuevo = usuario.reactivar();
      await this.usuarios.guardar(nuevo, actor.usuarioId);
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.reactivar',
          entidad: ENTIDAD,
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          antes: { activo: false },
          despues: { activo: true },
        },
        actor,
      );
      return vistaDeUsuario(nuevo, roles, empresaId, this.deps);
    });
  }

  /**
   * AUTH-D12 (el permiso en todas sus empresas activas) y, en cada una, la regla contra la
   * escalada sobre la persona (decisión del usuario, 6.7e). Devuelve esas empresas, con lo que
   * puede el usuario en cada una.
   */
  private async revisarSobrePersona(
    usuario: Usuario,
    permiso: keyof typeof PERMISOS_AUTH,
    daSuPoder: boolean,
    actor: Actor,
  ): Promise<{ empresaId: string; esAdministrador: boolean }[]> {
    await revisarCambioDePersona(usuario.id, permiso, actor, {
      ...this.deps,
      permisos: this.permisos,
    });
    const repos = { roles: this.roles, permisos: this.permisos };
    const ids = await empresasActivasDelUsuario(usuario.id, this.deps);
    const empresas = await Promise.all(
      ids.map(async (empresaId) => ({
        empresaId,
        quien: await poderEnEmpresa(actor.usuarioId ?? '', empresaId, repos),
        usuario: await poderEnEmpresa(usuario.id, empresaId, repos),
      })),
    );
    ReglasDeEscalada.revisarAccionSobrePersona({ empresas, daSuPoder });
    return empresas.map((e) => ({
      empresaId: e.empresaId,
      esAdministrador: e.usuario.esAdministrador,
    }));
  }

  /**
   * AUTH-D11 (4) en cada empresa donde es administrador: tiene que quedar otro administrador
   * activo. Bloquea la fila del rol Administrador antes de contar (como al quitar el rol), en el
   * orden de las empresas: dos desactivaciones a la vez no se esperan una a la otra en cruz.
   */
  private async revisarQueQuedenAdministradores(
    usuario: Usuario,
    empresas: readonly { empresaId: string; esAdministrador: boolean }[],
  ): Promise<void> {
    const dondeLoEs = empresas
      .filter((e) => e.esAdministrador)
      .map((e) => e.empresaId)
      .sort();
    for (const empresaId of dondeLoEs) {
      const administrador = (await this.roles.rolesDeUsuario(usuario.id, empresaId)).find(
        (rol) => rol.esAdministrador,
      );
      if (administrador === undefined) {
        continue;
      }
      await this.roles.buscarParaActualizar(administrador.id, empresaId);
      const activos = await this.roles.contarUsuarios(administrador.id);
      ReglasDeEscalada.revisarQueQuedeAdministrador(activos - 1);
    }
  }
}
