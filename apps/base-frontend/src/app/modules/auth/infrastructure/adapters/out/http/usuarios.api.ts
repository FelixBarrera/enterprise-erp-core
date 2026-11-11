import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { RespuestaApi } from '../../../../../../shared/infrastructure/http/respuesta-api';
import { URL_API } from '../../../../../../shared/infrastructure/http/url-api';
import type { HuellaDto } from './huella.dto';
import type { PaginaDto } from './roles.api';

export interface RolDeUsuarioDto {
  id: string;
  nombre: string;
  esAdministrador: boolean;
  activo: boolean;
}

export interface SesionAbiertaDto {
  id: string;
  iniciadaEn: string;
  ultimoUsoEn: string;
  ip: string | null;
  navegador: string | null;
}

/** Una fila de `GET /usuarios`. */
export interface UsuarioResumenDto {
  id: string;
  nombreUsuario: string;
  nombreCompleto: string;
  activo: boolean;
  bloqueadoHasta: string | null;
  ultimoIngresoEn: string | null;
  roles: RolDeUsuarioDto[];
  debeCambiarContrasena: boolean;
}

/** La ficha (`GET /usuarios/:id` y lo que responden sus cambios). */
export interface UsuarioDto extends UsuarioResumenDto {
  trabajaEnOtrasEmpresas: boolean;
  sesiones: SesionAbiertaDto[];
  creado: HuellaDto | null;
  modificado: HuellaDto | null;
}

/** Un rol de `GET /usuarios/roles-asignables`. */
export interface RolAsignableDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  esAdministrador: boolean;
  sePuedeDar: boolean;
}

/** Lo que responden `POST /usuarios` y `POST /usuarios/:id/contrasena-temporal`. */
export interface UsuarioCreadoDto {
  usuario: UsuarioDto;
  contrasenaTemporal: string;
}

/** Lo que responden «Quitar acceso» y «Cerrar sus sesiones». */
export interface AccesoQuitadoDto {
  id: string;
  sesionesCerradas: number;
}

/** Los parámetros de `GET /usuarios`, ya como texto. */
export interface ParametrosListaUsuarios {
  texto?: string;
  activo?: 'true' | 'false';
  rolId?: string;
  pagina: string;
  tamano: string;
}

/**
 * HTTP crudo de `/usuarios` (los de la empresa activa). Los 400, 404, 409 y 422 los muestra la
 * pantalla; el 403 sale con el aviso global.
 */
@Injectable()
export class UsuariosApi {
  private readonly http = inject(HttpClient);

  listar(
    parametros: ParametrosListaUsuarios,
  ): Observable<RespuestaApi<PaginaDto<UsuarioResumenDto>>> {
    return this.http.get<RespuestaApi<PaginaDto<UsuarioResumenDto>>>(`${URL_API}/usuarios`, {
      params: new HttpParams({ fromObject: { ...parametros } }),
    });
  }

  ver(id: string): Observable<RespuestaApi<UsuarioDto>> {
    return this.http.get<RespuestaApi<UsuarioDto>>(`${URL_API}/usuarios/${encodeURIComponent(id)}`);
  }

  rolesAsignables(): Observable<RespuestaApi<RolAsignableDto[]>> {
    return this.http.get<RespuestaApi<RolAsignableDto[]>>(`${URL_API}/usuarios/roles-asignables`);
  }

  editar(id: string, cambios: { nombreCompleto?: string }): Observable<RespuestaApi<UsuarioDto>> {
    return this.http.patch<RespuestaApi<UsuarioDto>>(
      `${URL_API}/usuarios/${encodeURIComponent(id)}`,
      cambios,
    );
  }

  fijarRoles(id: string, roles: string[]): Observable<RespuestaApi<UsuarioDto>> {
    return this.http.put<RespuestaApi<UsuarioDto>>(
      `${URL_API}/usuarios/${encodeURIComponent(id)}/roles`,
      { roles },
    );
  }

  crear(cuerpo: {
    nombreUsuario: string;
    nombreCompleto: string;
    roles: string[];
  }): Observable<RespuestaApi<UsuarioCreadoDto>> {
    return this.http.post<RespuestaApi<UsuarioCreadoDto>>(`${URL_API}/usuarios`, cuerpo);
  }

  quitarAcceso(id: string): Observable<RespuestaApi<AccesoQuitadoDto>> {
    return this.http.post<RespuestaApi<AccesoQuitadoDto>>(
      `${URL_API}/usuarios/${encodeURIComponent(id)}/quitar-acceso`,
      {},
    );
  }

  /** Las acciones sobre la persona (6.7e): todas `POST` sin cuerpo. */
  contrasenaTemporal(id: string): Observable<RespuestaApi<UsuarioCreadoDto>> {
    return this.accion<UsuarioCreadoDto>(id, 'contrasena-temporal');
  }

  desbloquear(id: string): Observable<RespuestaApi<UsuarioDto>> {
    return this.accion<UsuarioDto>(id, 'desbloquear');
  }

  cerrarSesiones(id: string): Observable<RespuestaApi<AccesoQuitadoDto>> {
    return this.accion<AccesoQuitadoDto>(id, 'cerrar-sesiones');
  }

  desactivar(id: string): Observable<RespuestaApi<UsuarioDto>> {
    return this.accion<UsuarioDto>(id, 'desactivar');
  }

  reactivar(id: string): Observable<RespuestaApi<UsuarioDto>> {
    return this.accion<UsuarioDto>(id, 'reactivar');
  }

  private accion<T>(id: string, accion: string): Observable<RespuestaApi<T>> {
    return this.http.post<RespuestaApi<T>>(
      `${URL_API}/usuarios/${encodeURIComponent(id)}/${accion}`,
      {},
    );
  }
}
