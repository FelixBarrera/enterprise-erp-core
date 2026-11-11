import type { NestExpressApplication } from '@nestjs/platform-express';
import { RELOJ_PORT } from '../src/shared/application/ports/reloj.port.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../src/shared/application/ports/unidad-de-trabajo.port.js';
import { actorDelSistema, type Actor } from '../src/shared/application/actor.js';
import { RelojFijo } from '../src/shared/application/testing/reloj-fijo.js';
import {
  REGISTRAR_AUDITORIA_PORT,
  type RegistrarAuditoriaPort,
} from '../src/modules/auditoria/application/ports/in/registrar-auditoria.port.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd, vaciarAuditoria } from './utilidades/limpiar-bd.js';

const EMPRESA = '0190a4f2-1c2b-7000-8000-000000000002';
const USUARIO = '0190a4f2-1c2b-7000-8000-000000000001';
const ENTIDAD = '0190a4f2-1c2b-7000-8000-00000000000a';
const actor: Actor = {
  usuarioId: USUARIO,
  nombreUsuario: 'ana',
  empresaId: EMPRESA,
  ip: '10.0.0.5',
  navegador: 'Firefox',
  requestId: 'req-1',
};

describe('Auditoría: registro (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let auditoria: RegistrarAuditoriaPort;
  let unidad: UnidadDeTrabajoPort;

  const contar = () => prisma.eventoAuditoria.count();
  const insertarDirecto = () =>
    prisma.$executeRaw`INSERT INTO auditoria.eventos (id, ocurrido_en, accion)
      VALUES (gen_random_uuid(), now(), 'm.r.a')`;

  beforeAll(async () => {
    const reloj = new RelojFijo('2026-07-15T11:00:00-05:00');
    app = await crearApp({ sobrescribir: (b) => b.overrideProvider(RELOJ_PORT).useValue(reloj) });
    prisma = app.get(PrismaService);
    auditoria = app.get(REGISTRAR_AUDITORIA_PORT);
    unidad = app.get(UNIDAD_DE_TRABAJO_PORT);
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('guarda el evento con todo lo de quien operó y solo lo que cambió', async () => {
    await auditoria.registrar(
      {
        accion: 'auth.usuario.editar',
        entidad: 'usuario',
        entidadId: ENTIDAD,
        antes: { nombre: 'Ana', activo: true, hashContrasena: 'h1' },
        despues: { nombre: 'Ana María', activo: true, hashContrasena: 'h2' },
      },
      actor,
    );
    const [fila] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT ocurrido_en, empresa_id::text, usuario_id::text, nombre_usuario, accion, entidad,
             entidad_id::text, antes, despues, ip, navegador, request_id
      FROM auditoria.eventos`;
    expect(fila).toEqual({
      ocurrido_en: new Date('2026-07-15T16:00:00Z'),
      empresa_id: EMPRESA,
      usuario_id: USUARIO,
      nombre_usuario: 'ana',
      accion: 'auth.usuario.editar',
      entidad: 'usuario',
      entidad_id: ENTIDAD,
      antes: { nombre: 'Ana', hashContrasena: '[OCULTO]' },
      despues: { nombre: 'Ana María', hashContrasena: '[OCULTO]' },
      ip: '10.0.0.5',
      navegador: 'Firefox',
      request_id: 'req-1',
    });
  });

  it('sin antes ni despues, las columnas quedan en NULL', async () => {
    await auditoria.registrar({ accion: 'auth.sesion.iniciar' }, actorDelSistema());
    const [fila] = await prisma.$queryRaw<{ sin_cambios: boolean }[]>`
      SELECT antes IS NULL AND despues IS NULL AS sin_cambios FROM auditoria.eventos`;
    expect(fila?.sin_cambios).toBe(true);
  });

  it('si nada cambió, no hay evento', async () => {
    await auditoria.registrar({ accion: 'm.r.a', antes: { a: 1 }, despues: { a: 1 } }, actor);
    expect(await contar()).toBe(0);
  });

  describe('misma transacción (AUD-D6)', () => {
    it('si el cambio se deshace, el evento también', async () => {
      await expect(
        unidad.ejecutar(async () => {
          await auditoria.registrar({ accion: 'm.r.a' }, actor);
          throw new Error('falló el cambio');
        }),
      ).rejects.toThrow('falló el cambio');
      expect(await contar()).toBe(0);
    });

    it('si sale bien, el evento queda', async () => {
      await unidad.ejecutar(() => auditoria.registrar({ accion: 'm.r.a' }, actor));
      expect(await contar()).toBe(1);
    });
  });

  describe('inmutable (AUD-D1)', () => {
    beforeEach(async () => {
      await auditoria.registrar({ accion: 'm.r.a' }, actor);
    });

    it('UPDATE falla', async () => {
      await expect(
        prisma.$executeRaw`UPDATE auditoria.eventos SET accion = 'x.y.z'`,
      ).rejects.toThrow(/no se puede modificar ni borrar/);
    });

    it('DELETE falla', async () => {
      await expect(prisma.$executeRaw`DELETE FROM auditoria.eventos`).rejects.toThrow(
        /no se puede modificar ni borrar/,
      );
      expect(await contar()).toBe(1);
    });

    it('TRUNCATE falla', async () => {
      await expect(prisma.$executeRaw`TRUNCATE auditoria.eventos`).rejects.toThrow(
        /no se puede modificar ni borrar/,
      );
      expect(await contar()).toBe(1);
    });

    it('vaciarAuditoria() sí la vacía (solo en la base de pruebas)', async () => {
      await vaciarAuditoria(prisma);
      expect(await contar()).toBe(0);
    });
  });

  describe('la base es el último resguardo (CHECK)', () => {
    it('acepta un evento mínimo bien formado', async () => {
      await expect(insertarDirecto()).resolves.toBe(1);
    });

    it.each([
      [
        'acción sin formato',
        `INSERT INTO auditoria.eventos (id, ocurrido_en, accion) VALUES (gen_random_uuid(), now(), 'Mal')`,
      ],
      [
        'entidad sin id',
        `INSERT INTO auditoria.eventos (id, ocurrido_en, accion, entidad) VALUES (gen_random_uuid(), now(), 'm.r.a', 'usuario')`,
      ],
      [
        'id sin entidad',
        `INSERT INTO auditoria.eventos (id, ocurrido_en, accion, entidad_id) VALUES (gen_random_uuid(), now(), 'm.r.a', gen_random_uuid())`,
      ],
      [
        'texto vacío',
        `INSERT INTO auditoria.eventos (id, ocurrido_en, accion, ip) VALUES (gen_random_uuid(), now(), 'm.r.a', ' ')`,
      ],
      [
        'antes que no es objeto',
        `INSERT INTO auditoria.eventos (id, ocurrido_en, accion, antes) VALUES (gen_random_uuid(), now(), 'm.r.a', '[1]')`,
      ],
    ])('%s: rechazado', async (_caso, sql) => {
      await expect(prisma.$executeRawUnsafe(sql)).rejects.toThrow(/violates check constraint/);
    });
  });
});
