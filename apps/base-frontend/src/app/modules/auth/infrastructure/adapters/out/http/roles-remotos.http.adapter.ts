import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Pagina, PedidoPagina } from '../../../../../../shared/domain/pagina';
import type { RolesRemotosPort } from '../../../../application/ports/out/roles-remotos.port';
import type { GrupoPermisos } from '../../../../domain/permisos-rol';
import type { CambiosRol, FiltrosRoles, NuevoRol, Rol, RolResumen } from '../../../../domain/rol';
import {
  type GrupoPermisosDto,
  type ParametrosListaRoles,
  type RolDto,
  RolesApi,
  type RolResumenDto,
} from './roles.api';

const aResumen = (dto: RolResumenDto): RolResumen => ({
  id: dto.id,
  nombre: dto.nombre,
  descripcion: dto.descripcion,
  esAdministrador: dto.esAdministrador,
  activo: dto.activo,
  cantidadUsuarios: dto.cantidadUsuarios,
  cantidadPermisos: dto.cantidadPermisos,
});

const aRol = (dto: RolDto): Rol => ({
  id: dto.id,
  nombre: dto.nombre,
  descripcion: dto.descripcion,
  esAdministrador: dto.esAdministrador,
  activo: dto.activo,
  cantidadUsuarios: dto.cantidadUsuarios,
  permisos: [...dto.permisos],
  creado: dto.creado,
  modificado: dto.modificado,
});

const aGrupo = (dto: GrupoPermisosDto): GrupoPermisos => ({
  modulo: dto.modulo,
  nombre: dto.nombre,
  permisos: dto.permisos.map((p) => ({ codigo: p.codigo, descripcion: p.descripcion })),
});

/** Los filtros de la pantalla, como los entiende `GET /roles`. */
export function parametrosDeLista(
  filtros: FiltrosRoles,
  pedido: PedidoPagina,
): ParametrosListaRoles {
  const texto = filtros.texto.trim();
  return {
    ...(texto === '' ? {} : { texto }),
    ...(filtros.estado === 'todos'
      ? {}
      : { activo: filtros.estado === 'activos' ? 'true' : 'false' }),
    pagina: String(pedido.pagina),
    tamano: String(pedido.tamano),
  };
}

@Injectable()
export class RolesRemotosHttpAdapter implements RolesRemotosPort {
  private readonly api = inject(RolesApi);

  async listar(filtros: FiltrosRoles, pedido: PedidoPagina): Promise<Pagina<RolResumen>> {
    const { data } = await firstValueFrom(this.api.listar(parametrosDeLista(filtros, pedido)));
    return { ...data, elementos: data.elementos.map(aResumen) };
  }

  async ver(id: string): Promise<Rol> {
    return aRol((await firstValueFrom(this.api.ver(id))).data);
  }

  async crear(nuevo: NuevoRol): Promise<Rol> {
    const dto = {
      nombre: nuevo.nombre,
      descripcion: nuevo.descripcion,
      permisos: [...nuevo.permisos],
    };
    return aRol((await firstValueFrom(this.api.crear(dto))).data);
  }

  async editar(id: string, cambios: CambiosRol): Promise<Rol> {
    return aRol((await firstValueFrom(this.api.editar(id, { ...cambios }))).data);
  }

  async fijarPermisos(id: string, permisos: readonly string[]): Promise<Rol> {
    return aRol((await firstValueFrom(this.api.fijarPermisos(id, [...permisos]))).data);
  }

  async desactivar(id: string): Promise<Rol> {
    return aRol((await firstValueFrom(this.api.desactivar(id))).data);
  }

  async reactivar(id: string): Promise<Rol> {
    return aRol((await firstValueFrom(this.api.reactivar(id))).data);
  }

  async catalogo(): Promise<GrupoPermisos[]> {
    return (await firstValueFrom(this.api.catalogo())).data.map(aGrupo);
  }
}
