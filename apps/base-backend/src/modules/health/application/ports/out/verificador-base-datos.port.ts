export const VERIFICADOR_BASE_DATOS_PORT = Symbol('VERIFICADOR_BASE_DATOS_PORT');

export interface VerificadorBaseDatosPort {
  /** `true` si la base responde a tiempo; nunca lanza error. */
  responde(): Promise<boolean>;
}
