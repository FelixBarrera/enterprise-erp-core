import type { Empresa } from '../../../domain/entities/empresa.entity.js';
import type { NombreEmpresa } from '../../../domain/value-objects/nombre-empresa.vo.js';

export const EMPRESAS_REPOSITORY_PORT = Symbol('EMPRESAS_REPOSITORY_PORT');

/** `organizacion.empresas`. Se une a la transacción en curso. */
export interface EmpresasRepositoryPort {
  /** `null` si no existe (o si el id no tiene forma de UUID). */
  buscarPorId(id: string): Promise<Empresa | null>;
  /**
   * Como `buscarPorId`, pero bloquea la fila hasta que termine la transacción: dos cambios a la
   * vez se ponen en fila y la bitácora guarda bien el «antes» de cada uno.
   */
  buscarParaActualizar(id: string): Promise<Empresa | null>;
  /** Ordenadas por nombre; los ids que no existen no salen. */
  buscarPorIds(ids: readonly string[]): Promise<Empresa[]>;
  /** Las activas, ordenadas por nombre. */
  listarActivas(): Promise<Empresa[]>;
  hayAlguna(): Promise<boolean>;
  /** Crea la empresa activa. `NombreEmpresaDuplicadoError` si ya hay una activa con ese nombre. */
  crear(nombre: NombreEmpresa, creadoPor: string | null): Promise<Empresa>;
  /** Guarda el nombre y si está activa. */
  guardar(empresa: Empresa, actualizadoPor: string | null): Promise<void>;
}
