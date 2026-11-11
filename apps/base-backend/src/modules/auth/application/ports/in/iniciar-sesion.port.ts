export const INICIAR_SESION_PORT = Symbol('INICIAR_SESION_PORT');

/** Lo que escribe la persona en la pantalla de login (sin validar: puede ser cualquier cosa). */
export interface IniciarSesionComando {
  readonly nombreUsuario: string;
  readonly contrasena: string;
}

/** Lo que devuelven el login y el refresh. */
export interface TokensSesion {
  /** Access token (JWT, 15 minutos): va en el cuerpo de la respuesta y la pantalla lo guarda en memoria. */
  readonly tokenAcceso: string;
  readonly expiraEnSegundos: number;
  /** Refresh token (`<sid>.<secreto>`): va solo en la cookie `httpOnly`, nunca en el cuerpo. */
  readonly tokenRefresco: string;
  /** Cuándo vence la sesión (máximo de la jornada): la cookie vence a la misma hora. */
  readonly sesionVenceEn: Date;
  /** Con una contraseña temporal, lo primero es cambiarla (AUTH-D14). */
  readonly debeCambiarContrasena: boolean;
}

/**
 * `POST /auth/login` (docs/modulos/auth-usuarios.md, sección 5). Un login fallido responde
 * siempre `CredencialesInvalidasError` (AUTH-D15) y deja el intento en la bitácora; con la
 * contraseña correcta pero sin empresa, `SinEmpresaError` (AUTH-D16). La IP y el navegador los
 * toma de la petición (`CONTEXTO_PETICION_PORT`).
 */
export interface IniciarSesionPort {
  execute(comando: IniciarSesionComando): Promise<TokensSesion>;
}
