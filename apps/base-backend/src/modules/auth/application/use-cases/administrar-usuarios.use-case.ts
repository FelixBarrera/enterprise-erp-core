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
import { NombreCompleto } from '../../domain/value-objects/nombre-completo.vo.js';
import type {
  AdministrarUsuariosPort,
  EditarUsuarioComando,
} from '../ports/in/administrar-usuarios.port.js';
import type { UsuarioVista } from '../ports/in/consultar-usuarios.port.js';
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
import {
  bloquearUsuarioDeEmpresa,
  type DependenciasFichaUsuario,
  empresaDeQuienOpera,
  revisarCambioDePersona,
  vistaDeUsuario,
} from './usuarios-comun.js';

const ENTIDAD = 'usuario';

/**
 * Cambios sobre los usuarios de la empresa activa. Lo que se puede revisar sin la base (el
 * nombre) se revisa antes de abrir la transacción; lo demás, con la fila del usuario bloqueada,
 * para que dos cambios a la vez dejen bien el «antes» de la bitácora.
 */
@Injectable()
export class AdministrarUsuariosUseCase implements AdministrarUsuariosPort {
  private readonly deps: DependenciasFichaUsuario;

  constructor(
    @Inject(USUARIOS_REPOSITORY_PORT) private readonly usuarios: UsuariosRepositoryPort,
    @Inject(ROLES_REPOSITORY_PORT) roles: RolesRepositoryPort,
    @Inject(PERMISOS_REPOSITORY_PORT) private readonly permisos: PermisosRepositoryPort,
    @Inject(SESIONES_REPOSITORY_PORT) sesiones: SesionesRepositoryPort,
    @Inject(CONSULTAR_EMPRESAS_PORT) empresas: ConsultarEmpresasPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
    @Inject(RELOJ_PORT) reloj: RelojPort,
    @Inject(OPCIONES_SESION) opciones: OpcionesSesion,
    @Inject(CONSULTAR_TRAZABILIDAD_PORT) trazabilidad: ConsultarTrazabilidadPort,
  ) {
    this.deps = { usuarios, roles, sesiones, empresas, reloj, opciones, trazabilidad };
  }

  async editar(id: string, comando: EditarUsuarioComando, actor: Actor): Promise<UsuarioVista> {
    const empresaId = empresaDeQuienOpera(actor);
    const nombre =
      comando.nombreCompleto === undefined
        ? undefined
        : NombreCompleto.crear(comando.nombreCompleto);
    return this.unidad.ejecutar(async () => {
      const { usuario, roles } = await bloquearUsuarioDeEmpresa(id, empresaId, this.deps);
      // AUTH-D12 siempre, aunque nada cambie: la pantalla lo sabe siempre igual.
      await revisarCambioDePersona(usuario.id, 'auth.usuario.editar', actor, {
        ...this.deps,
        permisos: this.permisos,
      });
      if (nombre === undefined || nombre.valor === usuario.nombreCompleto.valor) {
        return vistaDeUsuario(usuario, roles, empresaId, this.deps);
      }
      const editado = usuario.cambiarNombre(nombre);
      await this.usuarios.guardar(editado, actor.usuarioId);
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.editar',
          entidad: ENTIDAD,
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          antes: { nombreCompleto: usuario.nombreCompleto.valor },
          despues: { nombreCompleto: editado.nombreCompleto.valor },
        },
        actor,
      );
      return vistaDeUsuario(editado, roles, empresaId, this.deps);
    });
  }
}
