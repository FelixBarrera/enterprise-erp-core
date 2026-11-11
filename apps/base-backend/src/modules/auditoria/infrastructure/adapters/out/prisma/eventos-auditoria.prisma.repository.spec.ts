import { Prisma } from '../../../../../../generated/prisma/client.js';
import type { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import type { EventoAuditoria } from '../../../../domain/evento-auditoria.js';
import { EventosAuditoriaPrismaRepository } from './eventos-auditoria.prisma.repository.js';

const evento: EventoAuditoria = {
  ocurridoEn: new Date('2026-07-15T16:00:00Z'),
  empresaId: null,
  usuarioId: null,
  nombreUsuario: null,
  accion: 'm.r.a',
  entidad: null,
  entidadId: null,
  entidadNombre: null,
  antes: null,
  despues: { a: 1 },
  ip: null,
  navegador: null,
  requestId: null,
};

describe('EventosAuditoriaPrismaRepository', () => {
  it('sin cambios guarda NULL en la columna (DbNull), no el JSON null', async () => {
    const create = vi.fn(() => Promise.resolve({}));
    const repositorio = new EventosAuditoriaPrismaRepository({
      tx: { eventoAuditoria: { create } },
    } as unknown as TransaccionPrisma);
    await repositorio.guardar(evento);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: 'm.r.a', antes: Prisma.DbNull, despues: { a: 1 } }),
    });
  });
});

describe('EventosAuditoriaPrismaRepository: consulta', () => {
  const pedido = { pagina: 3, tamano: 10 };
  const rango = {
    desde: new Date('2026-11-01T05:00:00Z'),
    hastaAntesDe: new Date('2026-11-07T05:00:00Z'),
  };

  function crear(fila: unknown = null) {
    const findMany = vi.fn(() => Promise.resolve([]));
    const count = vi.fn(() => Promise.resolve(0));
    const findFirst = vi.fn(() => Promise.resolve(fila));
    const repositorio = new EventosAuditoriaPrismaRepository({
      tx: { eventoAuditoria: { findMany, count, findFirst } },
    } as unknown as TransaccionPrisma);
    return { repositorio, findMany, count, findFirst };
  }

  it('lista por empresa y rango, sin antes ni despues, del más nuevo al más viejo', async () => {
    const { repositorio, findMany, count } = crear();
    await repositorio.listar('e1', rango, pedido);
    const where = { empresaId: 'e1', ocurridoEn: { gte: rango.desde, lt: rango.hastaAntesDe } };
    expect(findMany).toHaveBeenCalledWith({
      where,
      omit: { antes: true, despues: true },
      orderBy: [{ ocurridoEn: 'desc' }, { id: 'desc' }],
      skip: 20,
      take: 10,
    });
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('la acción va exacta o como grupo; usuario y registro, tal cual', async () => {
    const { repositorio, count } = crear();
    await repositorio.listar(
      'e1',
      { ...rango, accion: 'auth.usuario', usuarioId: 'u1', entidad: 'usuario', entidadId: 'u2' },
      pedido,
    );
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        usuarioId: 'u1',
        entidad: 'usuario',
        entidadId: 'u2',
        OR: [{ accion: 'auth.usuario' }, { accion: { startsWith: 'auth.usuario.' } }],
      }),
    });
  });

  it('en el grupo, los comodines de LIKE van escapados', async () => {
    const { repositorio, count } = crear();
    await repositorio.listar('e1', { ...rango, accion: 'mi_modulo' }, pedido);
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [{ accion: 'mi_modulo' }, { accion: { startsWith: 'mi\\_modulo.' } }],
      }),
    });
  });

  it('buscarPorId: de esa empresa; antes y despues NULL o un objeto', async () => {
    const vacio = crear();
    expect(await vacio.repositorio.buscarPorId('ev1', 'e1')).toBeNull();
    expect(vacio.findFirst).toHaveBeenCalledWith({ where: { id: 'ev1', empresaId: 'e1' } });
    const { repositorio } = crear({ ...evento, id: 'ev1', antes: null, despues: { a: 1 } });
    expect(await repositorio.buscarPorId('ev1', 'e1')).toMatchObject({
      id: 'ev1',
      antes: null,
      despues: { a: 1 },
    });
  });
});
