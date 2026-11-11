import { HttpClient, HttpContext, HttpContextToken, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SIN_AVISO_GLOBAL } from '../../../../../../shared/infrastructure/http/errores.interceptor';
import type { RespuestaApi } from '../../../../../../shared/infrastructure/http/respuesta-api';
import { URL_API } from '../../../../../../shared/infrastructure/http/url-api';

/**
 * Marca las peticiones que el interceptor de sesión deja pasar tal cual: sin poner el token y sin
 * renovar ante un 401 (el login, el refresh y la lectura de la sesión con su propio token).
 */
export const SIN_INTERCEPTOR_SESION = new HttpContextToken<boolean>(() => false);

/** `data` de `POST /auth/login` y `POST /auth/refresh`. El refresh token va en la cookie. */
export interface SesionIniciadaDto {
  tokenAcceso: string;
  expiraEnSegundos: number;
  debeCambiarContrasena: boolean;
}

export interface EmpresaDeSesionDto {
  id: string;
  nombre: string;
}

/** `data` de `GET /auth/sesion`. */
export interface SesionDto {
  usuario: {
    id: string;
    nombreUsuario: string;
    nombreCompleto: string;
    debeCambiarContrasena: boolean;
  };
  empresaActiva: EmpresaDeSesionDto;
  empresas: EmpresaDeSesionDto[];
  esAdministrador: boolean;
  permisos: string[];
  zonaNegocio: string;
  sesionVenceEn: string;
}

/** HTTP crudo de `/auth`: solo las llamadas, sin convertir nada. */
@Injectable()
export class AuthApi {
  private readonly http = inject(HttpClient);

  /** El login muestra él mismo todas sus fallas (también el 403 «sin empresa»). */
  iniciar(nombreUsuario: string, contrasena: string): Observable<RespuestaApi<SesionIniciadaDto>> {
    return this.http.post<RespuestaApi<SesionIniciadaDto>>(
      `${URL_API}/auth/login`,
      { nombreUsuario, contrasena },
      { context: new HttpContext().set(SIN_AVISO_GLOBAL, true).set(SIN_INTERCEPTOR_SESION, true) },
    );
  }

  /** Con la cookie `token_refresco` (el navegador la manda sola: misma dirección). */
  renovar(): Observable<RespuestaApi<SesionIniciadaDto>> {
    return this.http.post<RespuestaApi<SesionIniciadaDto>>(
      `${URL_API}/auth/refresh`,
      {},
      { context: new HttpContext().set(SIN_INTERCEPTOR_SESION, true) },
    );
  }

  /** Con el token recién dado, que todavía no está guardado. */
  sesion(tokenAcceso: string): Observable<RespuestaApi<SesionDto>> {
    return this.http.get<RespuestaApi<SesionDto>>(`${URL_API}/auth/sesion`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${tokenAcceso}` }),
      context: new HttpContext().set(SIN_INTERCEPTOR_SESION, true),
    });
  }

  /** Con el token de la sesión (lo pone el interceptor, que también renueva si venció). */
  cerrar(): Observable<RespuestaApi<null>> {
    return this.http.post<RespuestaApi<null>>(`${URL_API}/auth/logout`, {});
  }

  /**
   * Con el token de la sesión (también con una contraseña temporal). La pantalla muestra ella
   * misma todas sus fallas: la actual incorrecta, la nueva débil y la cuenta bloqueada (403).
   */
  cambiarContrasena(
    contrasenaActual: string,
    contrasenaNueva: string,
  ): Observable<RespuestaApi<null>> {
    return this.http.post<RespuestaApi<null>>(
      `${URL_API}/auth/cambiar-contrasena`,
      { contrasenaActual, contrasenaNueva },
      { context: new HttpContext().set(SIN_AVISO_GLOBAL, true) },
    );
  }

  /**
   * Con el token de la sesión (sigue sirviendo con la empresa nueva). Responde la sesión como
   * `GET /auth/sesion`. El 403 «No tiene acceso a esa empresa» y la falta de conexión van con el
   * aviso global.
   */
  cambiarEmpresa(empresaId: string): Observable<RespuestaApi<SesionDto>> {
    return this.http.post<RespuestaApi<SesionDto>>(`${URL_API}/auth/empresa`, { empresaId });
  }
}
