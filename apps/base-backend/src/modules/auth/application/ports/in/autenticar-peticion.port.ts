import type { Actor } from '../../../../../shared/application/actor.js';

export const AUTENTICAR_PETICION_PORT = Symbol('AUTENTICAR_PETICION_PORT');

export interface AutenticarPeticionComando {
  /** El access token de la cabecera `Authorization: Bearer …`; `null` si no vino. */
  readonly tokenAcceso: string | null;
  /** La ruta se puede usar con una contraseña temporal (AUTH-D14). */
  readonly permiteContrasenaTemporal: boolean;
  /** El permiso de `@RequierePermiso()`; `null` si la ruta es `@SoloSesion()`. */
  readonly permisoRequerido: string | null;
}

/** Quién hace la petición, ya revisado. */
export interface PeticionAutenticada {
  readonly actor: Actor & { readonly usuarioId: string; readonly empresaId: string };
  readonly sesionId: string;
  readonly esAdministrador: boolean;
}

/**
 * Lo que hace el guard global en cada petición con sesión (sección 5 del diseño): token
 * válido → sesión viva → usuario activo → empresa activa y con un rol del usuario → AUTH-D14 → el permiso de la ruta (el Administrador
 * pasa). Cualquier problema: `SesionInvalidaError` (401); con contraseña temporal en otra ruta,
 * `DebeCambiarContrasenaError` (403); sin el permiso, `SinPermisoError` (403). No escribe nada
 * (AUTH-D8).
 */
export interface AutenticarPeticionPort {
  execute(comando: AutenticarPeticionComando): Promise<PeticionAutenticada>;
}
