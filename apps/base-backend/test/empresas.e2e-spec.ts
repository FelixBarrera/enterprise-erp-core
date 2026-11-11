import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
} from '../src/modules/empresas/application/ports/in/consultar-empresas.port.js';
import {
  CREAR_EMPRESA_PORT,
  type CrearEmpresaPort,
} from '../src/modules/empresas/application/ports/in/crear-empresa.port.js';
import {
  DESACTIVAR_EMPRESA_PORT,
  type DesactivarEmpresaPort,
} from '../src/modules/empresas/application/ports/in/desactivar-empresa.port.js';
import { actorDelSistema } from '../src/shared/application/actor.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../src/shared/application/ports/unidad-de-trabajo.port.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd } from './utilidades/limpiar-bd.js';

const actor = actorDelSistema({ nombreUsuario: 'comando' });

describe('Empresas (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let consultar: ConsultarEmpresasPort;
  let crear: CrearEmpresaPort;
  let desactivar: DesactivarEmpresaPort;
  let unidad: UnidadDeTrabajoPort;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    consultar = app.get(CONSULTAR_EMPRESAS_PORT);
    crear = app.get(CREAR_EMPRESA_PORT);
    desactivar = app.get(DESACTIVAR_EMPRESA_PORT);
    unidad = app.get(UNIDAD_DE_TRABAJO_PORT);
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea la empresa con UUID v7 y su evento en la bitácora, en esa empresa', async () => {
    const empresa = await crear.crear({ nombre: ' Comercial  del Sur ' }, actor);
    expect(empresa.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/u);
    const fila = await prisma.empresa.findUniqueOrThrow({ where: { id: empresa.id } });
    expect(fila).toMatchObject({ nombre: 'Comercial del Sur', activo: true, creadoPor: null });
    const eventos = await prisma.eventoAuditoria.findMany();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      accion: 'empresas.empresa.crear',
      empresaId: empresa.id,
      entidadId: empresa.id,
      despues: { nombre: 'Comercial del Sur', activo: true },
    });
  });

  describe('nombre único entre las activas (sin mayúsculas ni tildes)', () => {
    it('rechaza el mismo nombre escrito distinto', async () => {
      await crear.crear({ nombre: 'Café Ríos' }, actor);
      await expect(crear.crear({ nombre: 'CAFE RIOS' }, actor)).rejects.toThrow(
        'Ya existe una empresa con ese nombre',
      );
      expect(await prisma.empresa.count()).toBe(1);
      expect(await prisma.eventoAuditoria.count()).toBe(1);
    });

    it('una desactivada no impide crear otra con su nombre', async () => {
      const vieja = await crear.crear({ nombre: 'Acme' }, actor);
      await desactivar.desactivar(vieja.id, actor);
      const nueva = await crear.crear({ nombre: 'acme' }, actor);
      expect(nueva.id).not.toBe(vieja.id);
    });
  });

  it('desactivar: queda inactiva, con su evento; la segunda vez no cambia nada', async () => {
    const empresa = await crear.crear({ nombre: 'Acme' }, actor);
    expect((await desactivar.desactivar(empresa.id, actor)).yaEstabaDesactivada).toBe(false);
    expect((await desactivar.desactivar(empresa.id, actor)).yaEstabaDesactivada).toBe(true);
    expect(await consultar.buscarActiva(empresa.id)).toBeNull();
    const acciones = await prisma.eventoAuditoria.findMany({ select: { accion: true } });
    expect(acciones.map(({ accion }) => accion)).toEqual([
      'empresas.empresa.crear',
      'empresas.empresa.desactivar',
    ]);
  });

  it('desactivar una que no existe (o un id que no es UUID): 404', async () => {
    await expect(
      desactivar.desactivar('0190a4f2-1c2b-7000-8000-000000000009', actor),
    ).rejects.toThrow('La empresa no existe');
    await expect(desactivar.desactivar('no-es-uuid', actor)).rejects.toThrow(
      'La empresa no existe',
    );
  });

  it('consultas: buscarActiva, nombres (por nombre), hayAlguna y listarActivas', async () => {
    expect(await consultar.hayAlguna()).toBe(false);
    const zeta = await crear.crear({ nombre: 'Zeta' }, actor);
    const ambar = await crear.crear({ nombre: 'Ámbar' }, actor);
    expect(await consultar.hayAlguna()).toBe(true);
    expect(await consultar.buscarActiva(zeta.id)).toEqual(zeta);
    expect((await consultar.nombres([zeta.id, ambar.id, 'x'])).map(({ nombre }) => nombre)).toEqual(
      ['Ámbar', 'Zeta'],
    );
    await desactivar.desactivar(zeta.id, actor);
    expect(await consultar.listarActivas()).toEqual([ambar]);
  });

  it('dentro de otra transacción: si la de afuera falla, no queda ni la empresa ni el evento', async () => {
    await expect(
      unidad.ejecutar(async () => {
        await crear.crear({ nombre: 'Acme' }, actor);
        throw new Error('falló el administrador');
      }),
    ).rejects.toThrow('falló el administrador');
    expect(await prisma.empresa.count()).toBe(0);
    expect(await prisma.eventoAuditoria.count()).toBe(0);
  });

  it('la base rechaza un nombre vacío (CHECK)', async () => {
    await expect(
      prisma.$executeRaw`INSERT INTO organizacion.empresas (id, nombre, actualizado_en)
        VALUES (gen_random_uuid(), '   ', now())`,
    ).rejects.toThrow(/violates check constraint/u);
  });

  it('nombre_normalizado(): minúsculas y sin tildes', async () => {
    const [fila] = await prisma.$queryRaw<{ n: string }[]>`
      SELECT public.nombre_normalizado('Ñandú ÁÉÍÓÚ') AS n`;
    expect(fila?.n).toBe('nandu aeiou');
  });
});
