import { Empresa } from '../../domain/entities/empresa.entity.js';
import { NombreEmpresaDuplicadoError } from '../../domain/errors/empresas.errors.js';
import type { NombreEmpresa } from '../../domain/value-objects/nombre-empresa.vo.js';
import type { EmpresasRepositoryPort } from '../ports/out/empresas.repository.port.js';

/** Ids con forma de UUID (la bitácora los exige): `idDePrueba(1)` = `…-000000000001`. */
export const idDePrueba = (numero: number): string =>
  `0190a4f2-1c2b-7000-8000-${String(numero).padStart(12, '0')}`;

/** Igual que `nombre_normalizado()` de la base: minúsculas y sin tildes. */
const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Repositorio de empresas en memoria para los unitarios. Cumple el único de la base: no deja
 * dos activas con el mismo nombre sin importar mayúsculas ni tildes.
 */
export class EmpresasEnMemoria implements EmpresasRepositoryPort {
  readonly filas = new Map<
    string,
    { empresa: Empresa; creadoPor: string | null; actualizadoPor: string | null }
  >();
  private siguiente = 1;

  /** Para preparar datos: agrega la empresa tal cual. */
  agregar(empresa: Empresa): Empresa {
    this.filas.set(empresa.id, { empresa, creadoPor: null, actualizadoPor: null });
    return empresa;
  }

  buscarPorId(id: string): Promise<Empresa | null> {
    return Promise.resolve(this.filas.get(id)?.empresa ?? null);
  }

  /** En memoria no hay nada que bloquear. */
  buscarParaActualizar(id: string): Promise<Empresa | null> {
    return this.buscarPorId(id);
  }

  buscarPorIds(ids: readonly string[]): Promise<Empresa[]> {
    const empresas = [...this.filas.values()]
      .map(({ empresa }) => empresa)
      .filter(({ id }) => ids.includes(id))
      .sort((a, b) => a.nombre.valor.localeCompare(b.nombre.valor, 'es'));
    return Promise.resolve(empresas);
  }

  listarActivas(): Promise<Empresa[]> {
    const empresas = [...this.filas.values()]
      .map(({ empresa }) => empresa)
      .filter(({ activo }) => activo)
      .sort((a, b) => a.nombre.valor.localeCompare(b.nombre.valor, 'es'));
    return Promise.resolve(empresas);
  }

  hayAlguna(): Promise<boolean> {
    return Promise.resolve(this.filas.size > 0);
  }

  crear(nombre: NombreEmpresa, creadoPor: string | null): Promise<Empresa> {
    this.revisarUnico(nombre.valor, null);
    const id = idDePrueba(this.siguiente++);
    const empresa = Empresa.reconstruir({ id, nombre: nombre.valor, activo: true });
    this.filas.set(id, { empresa, creadoPor, actualizadoPor: creadoPor });
    return Promise.resolve(empresa);
  }

  guardar(empresa: Empresa, actualizadoPor: string | null): Promise<void> {
    const fila = this.filas.get(empresa.id);
    if (fila === undefined) {
      throw new Error(`No existe la empresa ${empresa.id}`);
    }
    if (empresa.activo) {
      this.revisarUnico(empresa.nombre.valor, empresa.id);
    }
    this.filas.set(empresa.id, { ...fila, empresa, actualizadoPor });
    return Promise.resolve();
  }

  private revisarUnico(nombre: string, salvoId: string | null): void {
    const repetida = [...this.filas.values()].some(
      ({ empresa }) =>
        empresa.activo &&
        empresa.id !== salvoId &&
        normalizar(empresa.nombre.valor) === normalizar(nombre),
    );
    if (repetida) {
      throw new NombreEmpresaDuplicadoError();
    }
  }
}
