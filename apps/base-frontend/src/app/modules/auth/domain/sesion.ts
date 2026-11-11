/** La persona que entró (lo que manda `GET /auth/sesion`). */
export interface UsuarioDeSesion {
  readonly id: string;
  readonly nombreUsuario: string;
  readonly nombreCompleto: string;
  /** Tiene una contraseña temporal: lo primero es cambiarla (AUTH-D14). */
  readonly debeCambiarContrasena: boolean;
}

export interface EmpresaDeSesion {
  readonly id: string;
  readonly nombre: string;
}

/** Con quién y dónde se está trabajando. Llega del backend; aquí no se calcula nada. */
export interface Sesion {
  readonly usuario: UsuarioDeSesion;
  readonly empresaActiva: EmpresaDeSesion;
  /** Todas en las que puede trabajar, por nombre. */
  readonly empresas: readonly EmpresaDeSesion[];
  readonly esAdministrador: boolean;
  /** Códigos `modulo.recurso.accion` vigentes en la empresa activa. */
  readonly permisos: readonly string[];
  /** Zona horaria del negocio: las fechas se muestran en ella (regla 11). */
  readonly zonaNegocio: string;
  /** Instante (ISO 8601) en que la sesión termina como mucho. */
  readonly sesionVenceEn: string;
}

/** El access token: vive solo en memoria. */
export interface TokenAcceso {
  readonly valor: string;
  readonly expiraEnSegundos: number;
}

/** Una sesión abierta en esta pestaña: el token y lo que dice el backend de ella. */
export interface SesionAbierta {
  readonly token: TokenAcceso;
  readonly sesion: Sesion;
}

/**
 * Lo que puede pasar al entrar. Hoy, solo `sesion-iniciada`; el segundo factor (AUTH-D18) se
 * sumará como otro caso (por ejemplo, `falta-segundo-factor`) sin cambiar la pantalla de hoy.
 */
export type ResultadoIngreso = { readonly tipo: 'sesion-iniciada'; readonly sesion: SesionAbierta };

/** Lo que escribe la persona en el login. El backend normaliza y valida; aquí, solo la forma. */
export interface Credenciales {
  readonly nombreUsuario: string;
  readonly contrasena: string;
}

/** Lo que escribe la persona para cambiar su contraseña (la actual o la temporal, y la nueva). */
export interface CambioContrasena {
  readonly actual: string;
  readonly nueva: string;
}

/**
 * La misma sesión después de cambiar la contraseña: ya no es temporal. El backend la deja así al
 * guardar (y no cambia nada más: ni la empresa ni los permisos), así que no hace falta volver a
 * pedirla.
 */
export function conContrasenaCambiada(sesion: Sesion): Sesion {
  return { ...sesion, usuario: { ...sesion.usuario, debeCambiarContrasena: false } };
}

/** Por permiso, nunca por rol. El Administrador los tiene todos (el backend ya los manda). */
export function tienePermiso(sesion: Sesion | null, codigo: string): boolean {
  if (sesion === null) return false;
  return sesion.esAdministrador || sesion.permisos.includes(codigo);
}

/** El selector de empresa solo aparece si hay más de una (AUTH-D4). */
export function trabajaEnVariasEmpresas(sesion: Sesion | null): boolean {
  return sesion !== null && sesion.empresas.length > 1;
}
