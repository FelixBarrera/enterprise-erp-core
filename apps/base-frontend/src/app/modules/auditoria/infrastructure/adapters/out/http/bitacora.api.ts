import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { RespuestaApi } from '../../../../../../shared/infrastructure/http/respuesta-api';
import { URL_API } from '../../../../../../shared/infrastructure/http/url-api';

/** Una fila de `GET /auditoria/eventos`. */
export interface EventoResumenDto {
  id: string;
  ocurridoEn: string;
  usuarioId: string | null;
  nombreUsuario: string | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  entidadNombre: string | null;
}

/** `GET /auditoria/eventos/:id`. `antes`/`despues` vienen del `jsonb`: se revisan al llegar. */
export interface EventoDetalleDto extends EventoResumenDto {
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  ip: string | null;
  navegador: string | null;
  requestId: string | null;
}

/** Un grupo de `GET /permisos` (solo lo que usa la bitácora). */
export interface GrupoPermisosDto {
  permisos: { codigo: string; descripcion: string }[];
}

/** Una persona de `GET /auditoria/usuarios`. */
export interface UsuarioDeBitacoraDto {
  usuarioId: string;
  nombreUsuario: string;
}

export interface PaginaDto<T> {
  elementos: T[];
  total: number;
  pagina: number;
  tamano: number;
}

/** Los parámetros de `GET /auditoria/eventos`, ya como texto. */
export interface ParametrosListaEventos {
  desde?: string;
  hasta?: string;
  usuarioId?: string;
  accion?: string;
  entidad?: string;
  entidadId?: string;
  pagina: string;
  tamano: string;
}

/**
 * HTTP crudo de `/auditoria` (la bitácora de la empresa activa) y del catálogo de permisos (para
 * mostrar los permisos de un rol; un módulo no usa otro: su propia llamada). El 400 (rango de
 * fechas) y el 404 los muestra la pantalla; el 403 sale con el aviso global.
 */
@Injectable()
export class BitacoraApi {
  private readonly http = inject(HttpClient);

  eventos(
    parametros: ParametrosListaEventos,
  ): Observable<RespuestaApi<PaginaDto<EventoResumenDto>>> {
    return this.http.get<RespuestaApi<PaginaDto<EventoResumenDto>>>(
      `${URL_API}/auditoria/eventos`,
      { params: new HttpParams({ fromObject: { ...parametros } }) },
    );
  }

  usuarios(): Observable<RespuestaApi<UsuarioDeBitacoraDto[]>> {
    return this.http.get<RespuestaApi<UsuarioDeBitacoraDto[]>>(`${URL_API}/auditoria/usuarios`);
  }

  evento(id: string): Observable<RespuestaApi<EventoDetalleDto>> {
    return this.http.get<RespuestaApi<EventoDetalleDto>>(
      `${URL_API}/auditoria/eventos/${encodeURIComponent(id)}`,
    );
  }

  permisos(): Observable<RespuestaApi<GrupoPermisosDto[]>> {
    return this.http.get<RespuestaApi<GrupoPermisosDto[]>>(`${URL_API}/permisos`);
  }
}
