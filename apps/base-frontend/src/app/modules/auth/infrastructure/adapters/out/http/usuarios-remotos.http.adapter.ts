import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Pagina, PedidoPagina } from '../../../../../../shared/domain/pagina';
import type { UsuariosRemotosPort } from '../../../../application/ports/out/usuarios-remotos.port';
import type {
  AccesoQuitado,
  CambiosUsuario,
  FiltrosUsuarios,
  RolAsignable,
  SesionesCerradas,
  Usuario,
  UsuarioCreado,
  UsuarioNuevo,
  UsuarioResumen,
} from '../../../../domain/usuario';
import {
  type ParametrosListaUsuarios,
  type RolAsignableDto,
  type UsuarioCreadoDto,
  type UsuarioDto,
  type UsuarioResumenDto,
  UsuariosApi,
} from './usuarios.api';

const aResumen = (dto: UsuarioResumenDto): UsuarioResumen => ({
  id: dto.id,
  nombreUsuario: dto.nombreUsuario,
  nombreCompleto: dto.nombreCompleto,
  activo: dto.activo,
  bloqueadoHasta: dto.bloqueadoHasta,
  ultimoIngresoEn: dto.ultimoIngresoEn,
  roles: dto.roles.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    esAdministrador: r.esAdministrador,
    activo: r.activo,
  })),
  debeCambiarContrasena: dto.debeCambiarContrasena,
});

const aUsuario = (dto: UsuarioDto): Usuario => ({
  ...aResumen(dto),
  trabajaEnOtrasEmpresas: dto.trabajaEnOtrasEmpresas,
  sesiones: dto.sesiones.map((s) => ({
    id: s.id,
    iniciadaEn: s.iniciadaEn,
    ultimoUsoEn: s.ultimoUsoEn,
    ip: s.ip,
    navegador: s.navegador,
  })),
  creado: dto.creado,
  modificado: dto.modificado,
});

const aUsuarioCreado = (dto: UsuarioCreadoDto): UsuarioCreado => ({
  usuario: aUsuario(dto.usuario),
  contrasenaTemporal: dto.contrasenaTemporal,
});

const aAsignable = (dto: RolAsignableDto): RolAsignable => ({
  id: dto.id,
  nombre: dto.nombre,
  descripcion: dto.descripcion,
  esAdministrador: dto.esAdministrador,
  sePuedeDar: dto.sePuedeDar,
});

/** Los filtros de la pantalla, como los entiende `GET /usuarios`. */
export function parametrosDeListaUsuarios(
  filtros: FiltrosUsuarios,
  pedido: PedidoPagina,
): ParametrosListaUsuarios {
  const texto = filtros.texto.trim();
  return {
    ...(texto === '' ? {} : { texto }),
    ...(filtros.estado === 'todos'
      ? {}
      : { activo: filtros.estado === 'activos' ? 'true' : 'false' }),
    ...(filtros.rol === '' ? {} : { rolId: filtros.rol }),
    pagina: String(pedido.pagina),
    tamano: String(pedido.tamano),
  };
}

@Injectable()
export class UsuariosRemotosHttpAdapter implements UsuariosRemotosPort {
  private readonly api = inject(UsuariosApi);

  async listar(filtros: FiltrosUsuarios, pedido: PedidoPagina): Promise<Pagina<UsuarioResumen>> {
    const parametros = parametrosDeListaUsuarios(filtros, pedido);
    const { data } = await firstValueFrom(this.api.listar(parametros));
    return { ...data, elementos: data.elementos.map(aResumen) };
  }

  async ver(id: string): Promise<Usuario> {
    return aUsuario((await firstValueFrom(this.api.ver(id))).data);
  }

  async rolesAsignables(): Promise<RolAsignable[]> {
    return (await firstValueFrom(this.api.rolesAsignables())).data.map(aAsignable);
  }

  async editar(id: string, cambios: CambiosUsuario): Promise<Usuario> {
    return aUsuario((await firstValueFrom(this.api.editar(id, { ...cambios }))).data);
  }

  async fijarRoles(id: string, roles: readonly string[]): Promise<Usuario> {
    return aUsuario((await firstValueFrom(this.api.fijarRoles(id, [...roles]))).data);
  }

  async crear(nuevo: UsuarioNuevo): Promise<UsuarioCreado> {
    const { data } = await firstValueFrom(this.api.crear({ ...nuevo, roles: [...nuevo.roles] }));
    return aUsuarioCreado(data);
  }

  async quitarAcceso(id: string): Promise<AccesoQuitado> {
    const { data } = await firstValueFrom(this.api.quitarAcceso(id));
    return { id: data.id, sesionesCerradas: data.sesionesCerradas };
  }

  async darContrasenaTemporal(id: string): Promise<UsuarioCreado> {
    return aUsuarioCreado((await firstValueFrom(this.api.contrasenaTemporal(id))).data);
  }

  async desbloquear(id: string): Promise<Usuario> {
    return aUsuario((await firstValueFrom(this.api.desbloquear(id))).data);
  }

  async cerrarSesiones(id: string): Promise<SesionesCerradas> {
    const { data } = await firstValueFrom(this.api.cerrarSesiones(id));
    return { id: data.id, sesionesCerradas: data.sesionesCerradas };
  }

  async desactivar(id: string): Promise<Usuario> {
    return aUsuario((await firstValueFrom(this.api.desactivar(id))).data);
  }

  async reactivar(id: string): Promise<Usuario> {
    return aUsuario((await firstValueFrom(this.api.reactivar(id))).data);
  }
}
