import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { urlBaseDePruebas } from './utilidades/base-de-pruebas.js';
import { limpiarBd } from './utilidades/limpiar-bd.js';

describe('Base de datos de pruebas (e2e)', () => {
  let modulo: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS prueba_limpiar_bd');
    await modulo.close();
  });

  it('los e2e corren contra una base que termina en _test, con las migraciones aplicadas', async () => {
    const [fila] = await prisma.$queryRaw<{ base: string; migraciones: bigint }[]>`
      SELECT current_database() AS base,
             (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migraciones`;
    expect(fila?.base).toMatch(/_test$/);
    expect(Number(fila?.migraciones)).toBeGreaterThan(0);
  });

  it('limpiarBd() vacía las tablas y deja el registro de migraciones', async () => {
    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS prueba_limpiar_bd (id int)');
    await prisma.$executeRawUnsafe('INSERT INTO prueba_limpiar_bd VALUES (1), (2)');

    await limpiarBd(prisma);

    const [tabla] = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM prueba_limpiar_bd`;
    const [migraciones] = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM _prisma_migrations`;
    expect(Number(tabla?.total)).toBe(0);
    expect(Number(migraciones?.total)).toBeGreaterThan(0);
  });
});

describe('urlBaseDePruebas', () => {
  const desarrollo = 'postgresql://u:c@localhost:5433/base_erp?schema=public';

  it('agrega _test al nombre de la base de DATABASE_URL', () => {
    expect(urlBaseDePruebas({ DATABASE_URL: desarrollo })).toBe(
      'postgresql://u:c@localhost:5433/base_erp_test?schema=public',
    );
  });

  it('usa DATABASE_URL_TEST si existe', () => {
    const url = 'postgresql://u:c@otra:5432/otra_test';
    expect(urlBaseDePruebas({ DATABASE_URL: desarrollo, DATABASE_URL_TEST: url })).toBe(url);
  });

  it('no arranca si DATABASE_URL_TEST no termina en _test', () => {
    expect(() => urlBaseDePruebas({ DATABASE_URL_TEST: desarrollo })).toThrow(
      'la base "base_erp" no termina en _test',
    );
  });

  it('no arranca sin ninguna URL', () => {
    expect(() => urlBaseDePruebas({})).toThrow('falta DATABASE_URL');
  });
});
