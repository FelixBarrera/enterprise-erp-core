import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../../generated/prisma/client.js';
import { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import { desplazamiento, type PedidoPagina } from '../../../../../../shared/application/pagina.js';
import type {
  BusquedaUltimoEvento,
  EventoAuditoriaGuardado,
  UltimoEvento,
  EventoResumenGuardado,
  EventosAuditoriaRepositoryPort,
  FiltrosEventos,
  UsuarioDeBitacora,
} from '../../../../application/ports/out/eventos-auditoria.repository.port.js';
import type { CambiosJson, EventoAuditoria } from '../../../../domain/evento-auditoria.js';

/**
 * `auditoria.eventos`: agrega (solo INSERT: los triggers impiden lo demás) y consulta. Las
 * búsquedas van siempre por empresa y rango de fechas, o por empresa y registro (la historia, sin
 * rango), que es como empiezan los índices de la tabla (docs/modulos/auditoria.md, sección 3).
 */
@Injectable()
export class EventosAuditoriaPrismaRepository implements EventosAuditoriaRepositoryPort {
  constructor(private readonly txHost: TransaccionPrisma) {}

  async guardar(evento: EventoAuditoria): Promise<void> {
    await this.txHost.tx.eventoAuditoria.create({
      data: {
        ocurridoEn: evento.ocurridoEn,
        empresaId: evento.empresaId,
        usuarioId: evento.usuarioId,
        nombreUsuario: evento.nombreUsuario,
        accion: evento.accion,
        entidad: evento.entidad,
        entidadId: evento.entidadId,
        entidadNombre: evento.entidadNombre,
        antes: aJson(evento.antes),
        despues: aJson(evento.despues),
        ip: evento.ip,
        navegador: evento.navegador,
        requestId: evento.requestId,
      },
    });
  }

  async listar(
    empresaId: string,
    filtros: FiltrosEventos,
    pedido: PedidoPagina,
  ): Promise<{ elementos: EventoResumenGuardado[]; total: number }> {
    const where = condiciones(empresaId, filtros);
    const [elementos, total] = await Promise.all([
      this.txHost.tx.eventoAuditoria.findMany({
        where,
        omit: { antes: true, despues: true },
        orderBy: [{ ocurridoEn: 'desc' }, { id: 'desc' }],
        skip: desplazamiento(pedido),
        take: pedido.tamano,
      }),
      this.txHost.tx.eventoAuditoria.count({ where }),
    ]);
    return { elementos, total };
  }

  async ultimoDe(busqueda: BusquedaUltimoEvento): Promise<UltimoEvento | null> {
    if (busqueda.acciones.length === 0) {
      return null;
    }
    return this.txHost.tx.eventoAuditoria.findFirst({
      where: {
        empresaId: busqueda.empresaId,
        entidad: busqueda.entidad,
        entidadId: busqueda.entidadId,
        accion: { in: [...busqueda.acciones] },
      },
      select: { id: true, ocurridoEn: true, nombreUsuario: true },
      orderBy: [{ ocurridoEn: 'desc' }, { id: 'desc' }],
    });
  }

  async usuariosDe(empresaId: string): Promise<UsuarioDeBitacora[]> {
    // Un «salto» por persona en el índice (empresa_id, usuario_id, …): la siguiente usuario_id
    // mayor que la anterior, y su nombre en su evento más nuevo. Con un DISTINCT, PostgreSQL
    // leería todos los eventos de la empresa (años de bitácora) para dar unas decenas de filas.
    return this.txHost.tx.$queryRaw<UsuarioDeBitacora[]>`
      WITH RECURSIVE quienes(usuario_id) AS (
        (SELECT e.usuario_id FROM auditoria.eventos e
          WHERE e.empresa_id = ${empresaId}::uuid AND e.usuario_id IS NOT NULL
          ORDER BY e.usuario_id LIMIT 1)
        UNION ALL
        SELECT (SELECT e.usuario_id FROM auditoria.eventos e
                 WHERE e.empresa_id = ${empresaId}::uuid AND e.usuario_id > q.usuario_id
                 ORDER BY e.usuario_id LIMIT 1)
          FROM quienes q
         WHERE q.usuario_id IS NOT NULL
      )
      SELECT q.usuario_id AS "usuarioId", n.nombre_usuario AS "nombreUsuario"
        FROM quienes q
        JOIN LATERAL (
          SELECT e.nombre_usuario FROM auditoria.eventos e
           WHERE e.empresa_id = ${empresaId}::uuid AND e.usuario_id = q.usuario_id
             AND e.nombre_usuario IS NOT NULL
           ORDER BY e.ocurrido_en DESC LIMIT 1
        ) n ON true
       ORDER BY n.nombre_usuario, q.usuario_id`;
  }

  async buscarPorId(id: string, empresaId: string): Promise<EventoAuditoriaGuardado | null> {
    const fila = await this.txHost.tx.eventoAuditoria.findFirst({ where: { id, empresaId } });
    if (fila === null) {
      return null;
    }
    return { ...fila, antes: deJson(fila.antes), despues: deJson(fila.despues) };
  }
}

function condiciones(empresaId: string, filtros: FiltrosEventos): Prisma.EventoAuditoriaWhereInput {
  const where: Prisma.EventoAuditoriaWhereInput = {
    empresaId,
    // Sin un extremo (la historia de un registro), sin tope de ese lado.
    ocurridoEn: { gte: filtros.desde, lt: filtros.hastaAntesDe },
  };
  if (filtros.usuarioId !== undefined) {
    where.usuarioId = filtros.usuarioId;
  }
  if (filtros.accion !== undefined) {
    // La acción exacta o su grupo: «auth.usuario» trae «auth.usuario.crear», no «auth.usuarios.x».
    // `startsWith` es un LIKE y Prisma no escapa sus comodines: «_» (válido en una acción)
    // valdría por cualquier letra.
    const grupo = `${filtros.accion.replace(/[\\%_]/gu, '\\$&')}.`;
    where.OR = [{ accion: filtros.accion }, { accion: { startsWith: grupo } }];
  }
  if (filtros.entidad !== undefined) {
    where.entidad = filtros.entidad;
  }
  if (filtros.entidadId !== undefined) {
    where.entidadId = filtros.entidadId;
  }
  return where;
}

/** La columna guarda siempre un objeto (lo arma `armarEventoAuditoria()`) o NULL. */
function deJson(valor: Prisma.JsonValue): CambiosJson | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as CambiosJson)
    : null;
}

/** Sin cambios = columna en NULL (no el JSON `null`). */
function aJson(cambios: CambiosJson | null): Prisma.InputJsonObject | typeof Prisma.DbNull {
  return cambios === null ? Prisma.DbNull : cambios;
}
