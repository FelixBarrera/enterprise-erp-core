import { Body, Controller, HttpCode, Inject, Injectable, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../src/shared/application/ports/unidad-de-trabajo.port.js';
import { DomainError, TipoErrorDominio } from '../src/shared/domain/errors/domain-error.js';
import { Publico } from '../src/shared/infrastructure/http/acceso/acceso.decorators.js';
import { ok } from '../src/shared/infrastructure/http/respuesta-api.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { TransaccionPrisma } from '../src/shared/infrastructure/transacciones/transaccion-prisma.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd } from './utilidades/limpiar-bd.js';

// Tabla solo de esta prueba (todavía no hay tablas de negocio). Se crea y se borra aquí.
const TABLA = 'pruebas_transacciones.notas';

/** Un repositorio como los de verdad: inyecta TransaccionPrisma, nunca PrismaService. */
@Injectable()
class NotasRepositorio {
  constructor(private readonly txHost: TransaccionPrisma) {}

  async guardar(texto: string): Promise<void> {
    await this.txHost.tx
      .$executeRaw`INSERT INTO pruebas_transacciones.notas (texto) VALUES (${texto})`;
  }

  async esperar(segundos: number): Promise<void> {
    await this.txHost.tx.$executeRaw`SELECT pg_sleep(${segundos})`;
  }

  enTransaccion(): boolean {
    return this.txHost.isTransactionActive();
  }
}

class NotaRechazadaError extends DomainError {
  constructor() {
    super(TipoErrorDominio.REGLA_NEGOCIO, 'La segunda nota no se puede guardar');
  }
}

/** Controller solo de prueba: hace lo que haría un caso de uso con dos escrituras. */
@Controller('prueba-transacciones')
class PruebaTransaccionesController {
  constructor(
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    private readonly notas: NotasRepositorio,
  ) {}

  @Post()
  @Publico()
  @HttpCode(201)
  async guardar(@Body() cuerpo: { fallar?: boolean }) {
    await this.unidad.ejecutar(async () => {
      await this.notas.guardar('primera');
      if (cuerpo.fallar === true) {
        throw new NotaRechazadaError();
      }
      await this.notas.guardar('segunda');
    });
    return ok(null, 'Notas guardadas');
  }
}

describe('Transacciones (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let unidad: UnidadDeTrabajoPort;
  let notas: NotasRepositorio;

  const textos = async (): Promise<string[]> => {
    const filas = await prisma.$queryRawUnsafe<{ texto: string }[]>(
      `SELECT texto FROM ${TABLA} ORDER BY id`,
    );
    return filas.map(({ texto }) => texto);
  };

  beforeAll(async () => {
    app = await crearApp({
      controllers: [PruebaTransaccionesController],
      providers: [NotasRepositorio],
    });
    prisma = app.get(PrismaService);
    unidad = app.get(UNIDAD_DE_TRABAJO_PORT);
    notas = app.get(NotasRepositorio);
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS pruebas_transacciones');
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS ${TABLA} (id serial PRIMARY KEY, texto text NOT NULL)`,
    );
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS pruebas_transacciones CASCADE');
    await app.close();
  });

  it('si todo sale bien, se guardan las dos escrituras', async () => {
    await unidad.ejecutar(async () => {
      await notas.guardar('a');
      await notas.guardar('b');
    });
    expect(await textos()).toEqual(['a', 'b']);
  });

  it('si algo falla, se deshace todo y el error sigue su camino', async () => {
    await expect(
      unidad.ejecutar(async () => {
        await notas.guardar('a');
        throw new Error('falló a la mitad');
      }),
    ).rejects.toThrow('falló a la mitad');
    expect(await textos()).toEqual([]);
  });

  it('devuelve lo que devuelve la función', async () => {
    await expect(unidad.ejecutar(() => Promise.resolve(7))).resolves.toBe(7);
  });

  it('un ejecutar() dentro de otro se une al de afuera: si el de afuera falla, se deshace todo', async () => {
    await expect(
      unidad.ejecutar(async () => {
        await unidad.ejecutar(async () => {
          await notas.guardar('de adentro');
        });
        throw new Error('falló el de afuera');
      }),
    ).rejects.toThrow('falló el de afuera');
    expect(await textos()).toEqual([]);
  });

  it('fuera de ejecutar() el repositorio escribe directo (sin transacción)', async () => {
    expect(notas.enTransaccion()).toBe(false);
    await notas.guardar('suelta');
    expect(await textos()).toEqual(['suelta']);
  });

  it('dos transacciones a la vez no se mezclan: la que falla no arrastra a la otra', async () => {
    const lenta = unidad.ejecutar(async () => {
      await notas.guardar('buena');
      await notas.esperar(0.2);
    });
    const mala = unidad.ejecutar(async () => {
      await notas.guardar('mala');
      await notas.esperar(0.1);
      throw new Error('falló la mala');
    });
    const [resultadoLenta, resultadoMala] = await Promise.allSettled([lenta, mala]);
    expect(resultadoLenta.status).toBe('fulfilled');
    expect(resultadoMala.status).toBe('rejected');
    expect(await textos()).toEqual(['buena']);
  });

  it('con tiempoMaximoMs, si se pasa del tiempo se deshace todo', async () => {
    await expect(
      unidad.ejecutar(
        async () => {
          await notas.guardar('tarde');
          await notas.esperar(0.5);
        },
        { tiempoMaximoMs: 100 },
      ),
    ).rejects.toThrow();
    expect(await textos()).toEqual([]);
  });

  describe('dentro de una petición', () => {
    it('201 y las dos notas guardadas', async () => {
      await request(app.getHttpServer()).post('/api/v1/prueba-transacciones').send({}).expect(201);
      expect(await textos()).toEqual(['primera', 'segunda']);
    });

    it('un error de negocio responde 422 y no deja nada a medias', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/v1/prueba-transacciones')
        .send({ fallar: true })
        .expect(422);
      expect(respuesta.body).toEqual({
        success: false,
        data: null,
        message: 'La segunda nota no se puede guardar',
      });
      expect(await textos()).toEqual([]);
    });
  });
});
