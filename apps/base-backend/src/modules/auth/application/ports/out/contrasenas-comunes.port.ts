export const CONTRASENAS_COMUNES_PORT = Symbol('CONTRASENAS_COMUNES_PORT');

/** La lista de contraseñas más comunes (AUTH-D20), cargada una vez al arrancar. */
export interface ContrasenasComunesPort {
  /** Si la contraseña (en minúsculas) está en la lista. Va como `esComun` de `ContextoContrasena`. */
  esComun(contrasena: string): boolean;
}
