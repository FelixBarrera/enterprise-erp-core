import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/application/actor.js';
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
import { SesionInvalidaError, SinAccesoEmpresaError } from '../../domain/errors/auth.errors.js';
import type {
  CambiarEmpresaComando,
  CambiarEmpresaPort,
} from '../ports/in/cambiar-empresa.port.js';
import {
  CONSULTAR_SESION_PORT,
  type ConsultarSesionPort,
  type SesionVista,
} from '../ports/in/consultar-sesion.port.js';
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
import { empresasDisponibles } from './sesion-comun.js';

@Injectable()
export class CambiarEmpresaUseCase implements CambiarEmpresaPort {
  constructor(
    @Inject(SESIONES_REPOSITORY_PORT) private readonly sesiones: SesionesRepositoryPort,
    @Inject(USUARIOS_REPOSITORY_PORT) private readonly usuarios: UsuariosRepositoryPort,
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(CONSULTAR_EMPRESAS_PORT) private readonly empresas: ConsultarEmpresasPort,
    @Inject(CONSULTAR_SESION_PORT) private readonly consultar: ConsultarSesionPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  async execute(comando: CambiarEmpresaComando, actor: Actor): Promise<SesionVista> {
    const disponibles = await empresasDisponibles(comando.usuarioId, this.roles, this.empresas);
    const destino = disponibles.find((empresa) => empresa.id === comando.empresaId);
    if (destino === undefined) {
      // Sin rol activo, desactivada o inexistente: el mismo error (no se dice cuál).
      throw new SinAccesoEmpresaError();
    }

    await this.unidad.ejecutar(async () => {
      // Con la fila bloqueada: un refresh o un logout al mismo tiempo no se pisan con esto.
      const sesion = await this.sesiones.buscarParaActualizar(comando.sesionId);
      if (sesion === null || !sesion.estaAbierta()) {
        throw new SesionInvalidaError();
      }
      if (sesion.empresaId === destino.id) {
        // Ya está en esa empresa: nada que cambiar ni que registrar.
        return;
      }
      const origen = sesion.empresaId;
      await this.sesiones.guardar(sesion.cambiarEmpresa(destino.id));
      const usuario = await this.usuarios.buscarParaActualizar(comando.usuarioId);
      if (usuario !== null) {
        await this.usuarios.guardar(usuario.usarEmpresa(destino.id), usuario.id);
      }
      await this.auditoria.registrar(
        {
          accion: 'auth.sesion.cambiar_empresa',
          entidad: 'sesion',
          entidadId: sesion.id,
          entidadNombre: usuario?.nombreUsuario.valor ?? actor.nombreUsuario,
          antes: { empresaId: origen },
          despues: { empresaId: destino.id, empresa: destino.nombre },
        },
        // En la empresa nueva: es donde trabaja desde ahora (decisión del usuario, 6.5d).
        { ...actor, empresaId: destino.id },
      );
    });

    const roles = await this.roles.rolesDeUsuario(comando.usuarioId, destino.id);
    return this.consultar.execute({
      sesionId: comando.sesionId,
      usuarioId: comando.usuarioId,
      empresaId: destino.id,
      // El de la empresa nueva (el guard calculó el de la anterior).
      esAdministrador: roles.some((rol) => rol.activo && rol.esAdministrador),
    });
  }
}
