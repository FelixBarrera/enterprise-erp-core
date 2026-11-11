import type { Contrasena } from '../../../domain/value-objects/contrasena.vo.js';

export const HASHER_CONTRASENA_PORT = Symbol('HASHER_CONTRASENA_PORT');

/**
 * Convierte la contraseña en un hash que no se puede revertir (Argon2id, formato PHC) y lo
 * verifica. Solo el hash se guarda.
 */
export interface HasherContrasenaPort {
  /** El hash de una contraseña nueva, ya validada. */
  calcularHash(contrasena: Contrasena): Promise<string>;
  /**
   * Si lo escrito corresponde al hash. Lo escrito no se valida (puede ser cualquier cosa) pero
   * se normaliza igual que al crearla (`normalizarContrasena()`). Un hash dañado da `false`.
   */
  verificar(hash: string, escrita: string): Promise<boolean>;
  /**
   * Para un login con un usuario que no existe: verifica contra un hash de relleno, para que
   * tarde lo mismo que uno que existe (así el tiempo no dice si el usuario existe). Siempre `false`.
   */
  verificarRelleno(escrita: string): Promise<false>;
}
