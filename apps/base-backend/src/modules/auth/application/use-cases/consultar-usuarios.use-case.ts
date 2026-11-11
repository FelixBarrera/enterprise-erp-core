import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTAR_TRAZABILIDAD_PORT,
  type ConsultarTrazabilidadPort,
} from '../../../auditoria/application/ports/in/consultar-trazabilidad.port.js';
import type { Actor } from '../../../../shared/application/actor.js';
import {
  crearPagina,
  type Pagina,
  type PedidoPagina,
} from '../../../../shared/application/pagina.js';
import { RELOJ_PORT, type RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
} from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import { UsuarioNoEncontradoError } from '../../domain/errors/auth.errors.js';
import { ReglasDeEscalada } from '../../domain/services/reglas-de-escalada.js';
import type {
  ConsultarUsuariosPort,
  RolAsignableVista,
  UsuarioResumenVista,
  UsuarioVista,
} from '../ports/in/consultar-usuarios.port.js';
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
  type FiltrosUsuarios,
  USUARIOS_REPOSITORY_PORT,
  type UsuariosRepositoryPort,
} from '../ports/out/usuarios.repository.port.js';
import {
  bloqueoVigente,
  type DependenciasFichaUsuario,
  empresaDeQuienOpera,
  vistaDeUsuario,
} from './usuarios-comun.js';
import { quienActua } from './roles-comun.js';

/**
 * La lista y la ficha de los usuarios de la empresa activa, y los roles que se les pueden dar
 * (`auth.usuario.ver`).
 */
@Injectable()
export class ConsultarUsuariosUseCase implements ConsultarUsuariosPort {
  private readonly deps: DependenciasFichaUsuario;

  constructor(
    @Inject(USUARIOS_REPOSITORY_PORT) private readonly usuarios: UsuariosRepositoryPort,
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(SESIONES_REPOSITORY_PORT) sesiones: SesionesRepositoryPort,
    @Inject(CONSULTAR_EMPRESAS_PORT) empresas: ConsultarEmpresasPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
    @Inject(OPCIONES_SESION) opciones: OpcionesSesion,
    @Inject(CONSULTAR_TRAZABILIDAD_PORT) trazabilidad: ConsultarTrazabilidadPort,
    @Inject(PERMISOS_REPOSITORY_PORT) private readonly permisos: PermisosRepositoryPort,
  ) {
    this.deps = { usuarios, roles, sesiones, empresas, reloj, opciones, trazabilidad };
  }

  async listar(
    filtros: FiltrosUsuarios,
    pedido: PedidoPagina,
    actor: Actor,
  ): Promise<Pagina<UsuarioResumenVista>> {
    const empresaId = empresaDeQuienOpera(actor);
    const { elementos, total } = await this.usuarios.listarDeEmpresa(empresaId, filtros, pedido);
    const ahora = this.reloj.ahora();
    const vistas = elementos.map((fila): UsuarioResumenVista => ({
      id: fila.id,
      nombreUsuario: fila.nombreUsuario,
      nombreCompleto: fila.nombreCompleto,
      activo: fila.activo,
      bloqueadoHasta: bloqueoVigente(fila.bloqueadoHasta, ahora),
      ultimoIngresoEn: fila.ultimoIngresoEn,
      debeCambiarContrasena: fila.debeCambiarContrasena,
      roles: fila.roles.map((rol) => ({ ...rol })),
    }));
    return crearPagina(vistas, total, pedido);
  }

  async rolesAsignables(actor: Actor): Promise<RolAsignableVista[]> {
    const empresaId = empresaDeQuienOpera(actor);
    const repos = { roles: this.roles, permisos: this.permisos };
    const [roles, quien] = await Promise.all([
      this.roles.activosDeEmpresa(empresaId),
      quienActua(actor, empresaId, repos),
    ]);
    // El Administrador no se mira por sus permisos (solo lo da un administrador): una consulta.
    const permisosDe = await this.permisos.codigosDeRoles(
      roles.filter((rol) => !rol.esAdministrador).map((rol) => rol.id),
    );
    return roles.map((rol) => ({
      id: rol.id,
      nombre: rol.nombre.valor,
      descripcion: rol.descripcion,
      esAdministrador: rol.esAdministrador,
      sePuedeDar: ReglasDeEscalada.puedeDarRol(quien, {
        id: rol.id,
        esAdministrador: rol.esAdministrador,
        permisos: permisosDe.get(rol.id) ?? [],
      }),
    }));
  }

  async ver(id: string, actor: Actor): Promise<UsuarioVista> {
    const empresaId = empresaDeQuienOpera(actor);
    const [usuario, roles] = await Promise.all([
      this.usuarios.buscarPorId(id),
      this.roles.rolesDeUsuario(id, empresaId),
    ]);
    if (usuario === null || roles.length === 0) {
      throw new UsuarioNoEncontradoError();
    }
    return vistaDeUsuario(usuario, roles, empresaId, this.deps);
  }
}
