import type { Actor } from '../../../../../shared/application/actor.js';

export const CAMBIAR_CONTRASENA_PORT = Symbol('CAMBIAR_CONTRASENA_PORT');

export interface CambiarContrasenaComando {
  /** La sesión desde la que se cambia: es la única que sigue abierta. */
  readonly sesionId: string;
  readonly usuarioId: string;
  readonly contrasenaActual: string;
  readonly contrasenaNueva: string;
}

/**
 * `POST /auth/cambiar-contrasena`: la propia contraseña, pidiendo la actual (también con una
 * temporal: AUTH-D14). Una actual incorrecta cuenta como intento fallido y al quinto bloquea 15
 * minutos (decisión del usuario, 6.5d); mientras está bloqueada, `CuentaBloqueadaError`. La nueva
 * cumple `Contrasena` y no puede ser igual a la actual. Quita la marca de temporal, cierra las
 * **otras** sesiones (`CAMBIO_CONTRASENA`) y registra `auth.usuario.cambiar_contrasena`.
 */
export interface CambiarContrasenaPort {
  execute(comando: CambiarContrasenaComando, actor: Actor): Promise<void>;
}
