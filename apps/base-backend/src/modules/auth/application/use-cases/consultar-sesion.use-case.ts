import { Inject, Injectable } from '@nestjs/common';
import { zonaNegocio } from '../../../../shared/domain/zona-negocio.js';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
} from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import { SesionInvalidaError } from '../../domain/errors/auth.errors.js';
import type {
  ConsultarSesionComando,
  ConsultarSesionPort,
  SesionVista,
} from '../ports/in/consultar-sesion.port.js';
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
import { empresasDisponibles } from './sesion-comun.js';

@Injectable()
export class ConsultarSesionUseCase implements ConsultarSesionPort {
  constructor(
    @Inject(SESIONES_REPOSITORY_PORT) private readonly sesiones: SesionesRepositoryPort,
    @Inject(USUARIOS_REPOSITORY_PORT) private readonly usuarios: UsuariosRepositoryPort,
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(CONSULTAR_EMPRESAS_PORT) private readonly empresas: ConsultarEmpresasPort,
    @Inject(PERMISOS_REPOSITORY_PORT) private readonly permisos: PermisosRepositoryPort,
  ) {}

  async execute(comando: ConsultarSesionComando): Promise<SesionVista> {
    const [sesion, usuario, disponibles, permisos] = await Promise.all([
      this.sesiones.buscarPorId(comando.sesionId),
      this.usuarios.buscarPorId(comando.usuarioId),
      empresasDisponibles(comando.usuarioId, this.roles, this.empresas),
      // El Administrador tiene todos (AUTH-D10): la pantalla no tiene que saber esa regla.
      comando.esAdministrador
        ? this.permisos.codigosVigentes()
        : this.permisos.codigosDeUsuario(comando.usuarioId, comando.empresaId),
    ]);
    const activa = disponibles.find((empresa) => empresa.id === comando.empresaId);
    // El guard acaba de revisarlo: solo falla si algo cambió en este mismo instante.
    if (sesion === null || usuario === null || activa === undefined) {
      throw new SesionInvalidaError();
    }
    return {
      usuario: {
        id: usuario.id,
        nombreUsuario: usuario.nombreUsuario.valor,
        nombreCompleto: usuario.nombreCompleto.valor,
        debeCambiarContrasena: usuario.debeCambiarContrasena,
      },
      empresaActiva: { id: activa.id, nombre: activa.nombre },
      empresas: disponibles.map((empresa) => ({ id: empresa.id, nombre: empresa.nombre })),
      esAdministrador: comando.esAdministrador,
      permisos,
      zonaNegocio: zonaNegocio(),
      sesionVenceEn: sesion.venceEn,
    };
  }
}
