import { Injectable } from '@nestjs/common';
import { indiceUnicoViolado } from '../../../../../../shared/infrastructure/prisma/errores-prisma.js';
import { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import type { EmpresasRepositoryPort } from '../../../../application/ports/out/empresas.repository.port.js';
import { Empresa } from '../../../../domain/entities/empresa.entity.js';
import { NombreEmpresaDuplicadoError } from '../../../../domain/errors/empresas.errors.js';
import type { NombreEmpresa } from '../../../../domain/value-objects/nombre-empresa.vo.js';

/** Índice único parcial escrito a mano en la migración crear_empresas. */
const INDICE_NOMBRE_ACTIVAS = 'empresas_nombre_activas_key';
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const COLUMNAS = { id: true, nombre: true, activo: true } as const;

/** `organizacion.empresas`. */
@Injectable()
export class EmpresasPrismaRepository implements EmpresasRepositoryPort {
  constructor(private readonly txHost: TransaccionPrisma) {}

  async buscarPorId(id: string): Promise<Empresa | null> {
    // Un id que no es UUID haría fallar a PostgreSQL (500): no existe, y listo.
    if (!PATRON_UUID.test(id)) {
      return null;
    }
    const fila = await this.txHost.tx.empresa.findUnique({ where: { id }, select: COLUMNAS });
    return fila === null ? null : Empresa.reconstruir(fila);
  }

  async buscarParaActualizar(id: string): Promise<Empresa | null> {
    if (!PATRON_UUID.test(id)) {
      return null;
    }
    await this.txHost.tx
      .$queryRaw`SELECT 1 FROM organizacion.empresas WHERE id = ${id}::uuid FOR UPDATE`;
    return this.buscarPorId(id);
  }

  async buscarPorIds(ids: readonly string[]): Promise<Empresa[]> {
    const validos = ids.filter((id) => PATRON_UUID.test(id));
    if (validos.length === 0) {
      return [];
    }
    const filas = await this.txHost.tx.empresa.findMany({
      where: { id: { in: validos } },
      select: COLUMNAS,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
    return filas.map((fila) => Empresa.reconstruir(fila));
  }

  async listarActivas(): Promise<Empresa[]> {
    const filas = await this.txHost.tx.empresa.findMany({
      where: { activo: true },
      select: COLUMNAS,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
    return filas.map((fila) => Empresa.reconstruir(fila));
  }

  async hayAlguna(): Promise<boolean> {
    const fila = await this.txHost.tx.empresa.findFirst({ select: { id: true } });
    return fila !== null;
  }

  async crear(nombre: NombreEmpresa, creadoPor: string | null): Promise<Empresa> {
    try {
      const fila = await this.txHost.tx.empresa.create({
        data: { nombre: nombre.valor, creadoPor, actualizadoPor: creadoPor },
        select: COLUMNAS,
      });
      return Empresa.reconstruir(fila);
    } catch (error) {
      throw traducir(error);
    }
  }

  async guardar(empresa: Empresa, actualizadoPor: string | null): Promise<void> {
    try {
      await this.txHost.tx.empresa.update({
        where: { id: empresa.id },
        data: { nombre: empresa.nombre.valor, activo: empresa.activo, actualizadoPor },
      });
    } catch (error) {
      throw traducir(error);
    }
  }
}

function traducir(error: unknown): unknown {
  return indiceUnicoViolado(error, INDICE_NOMBRE_ACTIVAS)
    ? new NombreEmpresaDuplicadoError()
    : error;
}
