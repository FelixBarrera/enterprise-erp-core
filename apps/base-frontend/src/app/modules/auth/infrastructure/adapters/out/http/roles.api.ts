import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { RespuestaApi } from '../../../../../../shared/infrastructure/http/respuesta-api';
import { URL_API } from '../../../../../../shared/infrastructure/http/url-api';
import type { HuellaDto } from './huella.dto';

/** Lo común de una fila y de la ficha. */
interface RolBaseDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  esAdministrador: boolean;
  activo: boolean;
  cantidadUsuarios: number;
}

/** Una fila de `GET /roles`. */
export interface RolResumenDto extends RolBaseDto {
  cantidadPermisos: number;
}

/** La ficha (`GET /roles/:id` y lo que responden sus cambios). */
export interface RolDto extends RolBaseDto {
  permisos: string[];
  creado: HuellaDto | null;
  modificado: HuellaDto | null;
}

export interface PaginaDto<T> {
  elementos: T[];
  total: number;
  pagina: number;
  tamano: number;
}

/** Un grupo de `GET /permisos`. */
export interface GrupoPermisosDto {
  modulo: string;
  nombre: string;
  permisos: { codigo: string; descripcion: string }[];
}

/** El cuerpo de `POST /roles`. */
export interface CrearRolDto {
  nombre: string;
  descripcion: string | null;
  permisos: string[];
}

/** Los parámetros de `GET /roles`, ya como texto. */
export interface ParametrosListaRoles {
  texto?: string;
  activo?: 'true' | 'false';
  pagina: string;
  tamano: string;
}

/**
 * HTTP crudo de `/roles` (los de la empresa activa) y del catálogo `/permisos`. Los 400, 404, 409 y 422 los muestra la
 * pantalla; el 403 sale con el aviso global.
 */
@Injectable()
export class RolesApi {
  private readonly http = inject(HttpClient);

  listar(parametros: ParametrosListaRoles): Observable<RespuestaApi<PaginaDto<RolResumenDto>>> {
    return this.http.get<RespuestaApi<PaginaDto<RolResumenDto>>>(`${URL_API}/roles`, {
      params: new HttpParams({ fromObject: { ...parametros } }),
    });
  }

  ver(id: string): Observable<RespuestaApi<RolDto>> {
    return this.http.get<RespuestaApi<RolDto>>(`${URL_API}/roles/${encodeURIComponent(id)}`);
  }

  crear(dto: CrearRolDto): Observable<RespuestaApi<RolDto>> {
    return this.http.post<RespuestaApi<RolDto>>(`${URL_API}/roles`, dto);
  }

  editar(
    id: string,
    cambios: { nombre?: string; descripcion?: string | null },
  ): Observable<RespuestaApi<RolDto>> {
    return this.http.patch<RespuestaApi<RolDto>>(
      `${URL_API}/roles/${encodeURIComponent(id)}`,
      cambios,
    );
  }

  fijarPermisos(id: string, permisos: string[]): Observable<RespuestaApi<RolDto>> {
    return this.http.put<RespuestaApi<RolDto>>(
      `${URL_API}/roles/${encodeURIComponent(id)}/permisos`,
      { permisos },
    );
  }

  desactivar(id: string): Observable<RespuestaApi<RolDto>> {
    return this.http.post<RespuestaApi<RolDto>>(
      `${URL_API}/roles/${encodeURIComponent(id)}/desactivar`,
      {},
    );
  }

  reactivar(id: string): Observable<RespuestaApi<RolDto>> {
    return this.http.post<RespuestaApi<RolDto>>(
      `${URL_API}/roles/${encodeURIComponent(id)}/reactivar`,
      {},
    );
  }

  catalogo(): Observable<RespuestaApi<GrupoPermisosDto[]>> {
    return this.http.get<RespuestaApi<GrupoPermisosDto[]>>(`${URL_API}/permisos`);
  }
}
