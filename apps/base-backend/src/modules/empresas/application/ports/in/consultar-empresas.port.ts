export const CONSULTAR_EMPRESAS_PORT = Symbol('CONSULTAR_EMPRESAS_PORT');

/** Lo que otro módulo ve de una empresa. */
export interface EmpresaConsultada {
  readonly id: string;
  readonly nombre: string;
  readonly activo: boolean;
}

/**
 * Consultas de empresas para otros módulos (el login arma con esto la lista de empresas del
 * usuario; el guard revisa que la empresa activa siga activa).
 */
export interface ConsultarEmpresasPort {
  /** La empresa, solo si existe y está activa; si no, `null`. */
  buscarActiva(id: string): Promise<EmpresaConsultada | null>;
  /** Las empresas de esos ids (activas o no), ordenadas por nombre. Los ids que no existen no salen. */
  nombres(ids: readonly string[]): Promise<EmpresaConsultada[]>;
  /** Las activas, ordenadas por nombre. Lo usa `admin:desactivar-empresa` para elegir una. */
  listarActivas(): Promise<EmpresaConsultada[]>;
  /** Si hay al menos una empresa (activa o no). Lo usa `admin:crear-inicial`. */
  hayAlguna(): Promise<boolean>;
}
