import { Controller, Get, Inject } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { RELOJ_PORT, type RelojPort } from '../src/shared/application/ports/reloj.port.js';
import { RelojFijo } from '../src/shared/application/testing/reloj-fijo.js';
import { Dinero } from '../src/shared/domain/value-objects/dinero.vo.js';
import { FechaFiscal } from '../src/shared/domain/value-objects/fecha-fiscal.vo.js';
import { zonaNegocio } from '../src/shared/domain/zona-negocio.js';
import { Publico } from '../src/shared/infrastructure/http/acceso/acceso.decorators.js';
import { ok } from '../src/shared/infrastructure/http/respuesta-api.js';
import { Prisma } from '../src/generated/prisma/client.js';
import {
  decimalADinero,
  dineroADecimal,
} from '../src/shared/infrastructure/prisma/conversiones.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearApp } from './utilidades/crear-app.js';

/** Controller solo de prueba: usa el reloj como lo haría un caso de uso. */
@Controller('prueba-hora')
class PruebaHoraController {
  constructor(@Inject(RELOJ_PORT) private readonly reloj: RelojPort) {}

  @Get()
  @Publico()
  consultar() {
    const ahora = this.reloj.ahora();
    return ok(
      { ahora, fecha: FechaFiscal.desdeInstante(ahora), total: Dinero.desdeTexto('10.5') },
      'Hora consultada',
    );
  }
}

// Este e2e corre con el proceso en America/New_York (vitest.config.e2e.ts), a propósito.
describe('Hora, fechas y dinero (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  // 20:00 en Guayaquil del 5 de noviembre: en UTC ya es 6 de noviembre.
  const reloj = new RelojFijo('2026-11-05T20:00:00-05:00');

  beforeAll(async () => {
    app = await crearApp({
      controllers: [PruebaHoraController],
      sobrescribir: (builder) => builder.overrideProvider(RELOJ_PORT).useValue(reloj),
    });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('el proceso está en otra zona (si no, la prueba no probaría nada)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York');
  });

  it('al arrancar, la app fija la zona del negocio del .env (por defecto, Guayaquil)', () => {
    expect(zonaNegocio()).toBe('America/Guayaquil');
  });

  it('la API usa el reloj fijado y la fecha del negocio es la de Guayaquil', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/prueba-hora').expect(200);
    expect(respuesta.body).toEqual({
      success: true,
      data: { ahora: '2026-11-06T01:00:00.000Z', fecha: '2026-11-05', total: '10.50' },
      message: 'Hora consultada',
    });
  });

  it('una FechaFiscal guardada en una columna date vuelve como el mismo día', async () => {
    const fecha = FechaFiscal.desdeTexto('2026-11-05');
    const [fila] = await prisma.$queryRaw<
      { fecha: Date }[]
    >`SELECT ${fecha.aFechaDb()}::date AS fecha`;
    expect(FechaFiscal.desdeFechaDb(fila!.fecha).aTexto()).toBe('2026-11-05');
  });

  it('un monto guardado como numeric(14,2) vuelve exacto, y la base suma sin perder centavos', async () => {
    const monto = Dinero.desdeTexto('0.10');
    const [fila] = await prisma.$queryRaw<{ total: Prisma.Decimal }[]>`
      SELECT (${dineroADecimal(monto)}::numeric(14,2) + ${dineroADecimal(Dinero.desdeTexto('0.20'))}::numeric(14,2))::numeric(14,2) AS total`;
    expect(decimalADinero(fila!.total).aTexto()).toBe('0.30');
  });
});
