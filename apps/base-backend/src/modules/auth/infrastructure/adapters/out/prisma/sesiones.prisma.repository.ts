import { Injectable } from '@nestjs/common';
import { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import type {
  NuevaSesion,
  SesionesRepositoryPort,
} from '../../../../application/ports/out/sesiones.repository.port.js';
import { type MotivoCierreSesion, Sesion } from '../../../../domain/entities/sesion.entity.js';
import { esUuid } from './es-uuid.js';

/** Largos de las columnas: lo que manda el navegador se recorta, no rompe el login. */
const LARGO_IP = 45;
const LARGO_NAVEGADOR = 300;

const COLUMNAS = {
  id: true,
  usuarioId: true,
  empresaId: true,
  hashRefresh: true,
  hashRefreshAnterior: true,
  rotadoEn: true,
  iniciadaEn: true,
  venceEn: true,
  ultimoUsoEn: true,
  cerradaEn: true,
  motivoCierre: true,
  ip: true,
  navegador: true,
} as const;

/** `seguridad.sesiones`. */
@Injectable()
export class SesionesPrismaRepository implements SesionesRepositoryPort {
  constructor(private readonly txHost: TransaccionPrisma) {}

  async crear(nueva: NuevaSesion): Promise<Sesion> {
    const fila = await this.txHost.tx.sesion.create({
      data: {
        usuarioId: nueva.usuarioId,
        empresaId: nueva.empresaId,
        hashRefresh: nueva.hashRefresh,
        iniciadaEn: nueva.iniciadaEn,
        venceEn: nueva.venceEn,
        ultimoUsoEn: nueva.iniciadaEn,
        ip: recortar(nueva.ip, LARGO_IP),
        navegador: recortar(nueva.navegador, LARGO_NAVEGADOR),
      },
      select: COLUMNAS,
    });
    return Sesion.reconstruir(fila);
  }

  async buscarPorId(id: string): Promise<Sesion | null> {
    if (!esUuid(id)) {
      return null;
    }
    const fila = await this.txHost.tx.sesion.findUnique({ where: { id }, select: COLUMNAS });
    return fila === null ? null : Sesion.reconstruir(fila);
  }

  async abiertasDeUsuarioEnEmpresa(usuarioId: string, empresaId: string): Promise<Sesion[]> {
    if (!esUuid(usuarioId) || !esUuid(empresaId)) {
      return [];
    }
    // Usa el índice parcial (usuario_id) WHERE cerrada_en IS NULL.
    const filas = await this.txHost.tx.sesion.findMany({
      where: { usuarioId, empresaId, cerradaEn: null },
      select: COLUMNAS,
      orderBy: [{ ultimoUsoEn: 'desc' }, { id: 'asc' }],
    });
    return filas.map((fila) => Sesion.reconstruir(fila));
  }

  async buscarParaActualizar(id: string): Promise<Sesion | null> {
    if (!esUuid(id)) {
      return null;
    }
    await this.txHost.tx
      .$queryRaw`SELECT 1 FROM seguridad.sesiones WHERE id = ${id}::uuid FOR UPDATE`;
    const fila = await this.txHost.tx.sesion.findUnique({ where: { id }, select: COLUMNAS });
    return fila === null ? null : Sesion.reconstruir(fila);
  }

  async guardar(sesion: Sesion): Promise<void> {
    const d = sesion.datos();
    await this.txHost.tx.sesion.update({
      where: { id: d.id },
      data: {
        empresaId: d.empresaId,
        hashRefresh: d.hashRefresh,
        hashRefreshAnterior: d.hashRefreshAnterior,
        rotadoEn: d.rotadoEn,
        ultimoUsoEn: d.ultimoUsoEn,
        cerradaEn: d.cerradaEn,
        motivoCierre: d.motivoCierre,
      },
    });
  }

  async cerrarTodasDelUsuario(
    usuarioId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number> {
    if (!esUuid(usuarioId)) {
      return 0;
    }
    const { count } = await this.txHost.tx.sesion.updateMany({
      where: { usuarioId, cerradaEn: null },
      data: { cerradaEn: ahora, motivoCierre: motivo },
    });
    return count;
  }

  async cerrarOtrasDelUsuario(
    usuarioId: string,
    exceptoSesionId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number> {
    if (!esUuid(usuarioId) || !esUuid(exceptoSesionId)) {
      return 0;
    }
    const { count } = await this.txHost.tx.sesion.updateMany({
      where: { usuarioId, cerradaEn: null, id: { not: exceptoSesionId } },
      data: { cerradaEn: ahora, motivoCierre: motivo },
    });
    return count;
  }

  async cerrarTodasDelUsuarioEnEmpresa(
    usuarioId: string,
    empresaId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number> {
    if (!esUuid(usuarioId) || !esUuid(empresaId)) {
      return 0;
    }
    // Usa el índice parcial (usuario_id) WHERE cerrada_en IS NULL.
    const { count } = await this.txHost.tx.sesion.updateMany({
      where: { usuarioId, empresaId, cerradaEn: null },
      data: { cerradaEn: ahora, motivoCierre: motivo },
    });
    return count;
  }

  async cerrarTodasDeEmpresa(
    empresaId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number> {
    if (!esUuid(empresaId)) {
      return 0;
    }
    // Usa el índice parcial (empresa_id) WHERE cerrada_en IS NULL.
    const { count } = await this.txHost.tx.sesion.updateMany({
      where: { empresaId, cerradaEn: null },
      data: { cerradaEn: ahora, motivoCierre: motivo },
    });
    return count;
  }
}

/**
 * Sin texto → `null` (nunca `''`); con texto, recortado al largo de la columna. Se cuenta por
 * carácter (punto de código), como cuenta PostgreSQL el `varchar(n)`: un emoji no se parte.
 */
function recortar(valor: string | null, largo: number): string | null {
  if (valor === null || valor.trim() === '') {
    return null;
  }
  return Array.from(valor).slice(0, largo).join('');
}
