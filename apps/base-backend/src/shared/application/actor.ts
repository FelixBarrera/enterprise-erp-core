/**
 * Quién hace una operación. Lo reciben todos los casos de uso que escriben (y la auditoría).
 *
 * - En una petición lo arma el guard del login (paso 6.5) y llega con `@UsuarioActual()`.
 * - Fuera de una petición (un comando, una cola) lo arma quien llama; si es el propio sistema,
 *   con `actorDelSistema()` (`usuarioId = null`).
 */
export interface Actor {
  /** `null` = un proceso del sistema (o un usuario que no existe, en un login fallido). */
  readonly usuarioId: string | null;
  /** El nombre de usuario tal como era en ese momento (queda así en la bitácora). */
  readonly nombreUsuario: string | null;
  /** La empresa activa de quien opera. `null` solo en lo que no es de una empresa. */
  readonly empresaId: string | null;
  readonly ip: string | null;
  readonly navegador: string | null;
  /** El número de la petición, para cruzar con el log del servidor. */
  readonly requestId: string | null;
}

/** El actor de un proceso del sistema (comandos, colas, tareas programadas). */
export function actorDelSistema(datos: Partial<Omit<Actor, 'usuarioId'>> = {}): Actor {
  return {
    usuarioId: null,
    nombreUsuario: datos.nombreUsuario ?? null,
    empresaId: datos.empresaId ?? null,
    ip: datos.ip ?? null,
    navegador: datos.navegador ?? null,
    requestId: datos.requestId ?? null,
  };
}
