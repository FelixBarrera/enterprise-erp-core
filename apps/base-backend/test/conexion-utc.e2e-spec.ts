import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

// La conexión del backend tiene que ir en UTC (docs/modelo-datos.md, sección 7).
// Si no, @prisma/adapter-pg guarda los instantes corridos 5 horas sin avisar.
describe('Conexión a PostgreSQL (e2e)', () => {
  let modulo: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await modulo.close();
  });

  it('la sesión usa la zona UTC', async () => {
    const [fila] = await prisma.$queryRaw<
      { zona: string }[]
    >`SELECT current_setting('TimeZone') AS zona`;
    expect(fila?.zona).toBe('UTC');
  });

  it('un instante guardado y leído vuelve igual', async () => {
    const instante = new Date('2026-11-05T20:00:00.000Z'); // 15:00 en Guayaquil
    const [fila] = await prisma.$queryRaw<
      { leido: Date }[]
    >`SELECT ${instante}::timestamptz AS leido`;
    expect(fila?.leido.toISOString()).toBe(instante.toISOString());
  });
});
