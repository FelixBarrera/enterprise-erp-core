import { Body, Controller, Get, Logger, Param, Post, Query } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import request from 'supertest';
import { DomainError, TipoErrorDominio } from '../src/shared/domain/errors/domain-error.js';
import { Publico } from '../src/shared/infrastructure/http/acceso/acceso.decorators.js';
import { ID_PIPE } from '../src/shared/infrastructure/http/id.pipe.js';
import { ok } from '../src/shared/infrastructure/http/respuesta-api.js';
import { crearApp } from './utilidades/crear-app.js';

class DireccionDto {
  @IsNotEmpty({ message: 'La ciudad no puede estar vacía' })
  @IsString({ message: 'La ciudad es obligatoria y debe ser texto' })
  ciudad!: string;
}

class CrearCosaDto {
  @MaxLength(20, { message: 'El nombre admite hasta 20 caracteres' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @IsString({ message: 'El nombre es obligatorio y debe ser texto' })
  nombre!: string;

  @ValidateNested()
  @Type(() => DireccionDto)
  direccion!: DireccionDto;
}

class FiltroDto {
  @Min(1, { message: 'La página empieza en 1' })
  @IsInt({ message: 'La página debe ser un número entero' })
  @Type(() => Number)
  pagina!: number;
}

/** Controller solo de prueba: provoca cada caso que la configuración HTTP debe manejar. */
@Controller('prueba')
class PruebaController {
  @Post('cosas')
  @Publico()
  crear(@Body() dto: CrearCosaDto) {
    return ok(dto, 'Cosa creada');
  }

  @Get('cosas')
  @Publico()
  listar(@Query() filtro: FiltroDto) {
    return ok({ pagina: filtro.pagina, tipo: typeof filtro.pagina }, 'Listado');
  }

  @Get('cosas/:id')
  @Publico()
  obtener(@Param('id', ID_PIPE) id: string) {
    return ok({ id }, 'Cosa encontrada');
  }

  @Get('errores/:tipo')
  @Publico()
  error(@Param('tipo') tipo: TipoErrorDominio) {
    throw new DomainError(tipo, `Mensaje de ${tipo}`);
  }

  @Get('falla')
  @Publico()
  falla() {
    throw new Error('detalle interno con datos sensibles');
  }
}

describe('Configuración HTTP: configureApp() (e2e)', () => {
  let app: NestExpressApplication;
  const servidor = () => app.getHttpServer();

  beforeAll(async () => {
    app = await crearApp({ controllers: [PruebaController] });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('cabeceras', () => {
    it('pone las cabeceras de helmet y Cache-Control: no-store', async () => {
      const respuesta = await request(servidor()).get('/api/v1/health');
      expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
      expect(respuesta.headers['x-powered-by']).toBeUndefined();
      expect(respuesta.headers['cache-control']).toBe('no-store');
    });

    it('también pone no-store en las respuestas de error', async () => {
      const respuesta = await request(servidor()).get('/api/v1/no-existe');
      expect(respuesta.headers['cache-control']).toBe('no-store');
    });

    it('CORS: permite el origen de CORS_ORIGINS, con cookies', async () => {
      const respuesta = await request(servidor())
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:4200');
      expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:4200');
      expect(respuesta.headers['access-control-allow-credentials']).toBe('true');
    });

    it('CORS: no permite otro origen', async () => {
      const respuesta = await request(servidor())
        .get('/api/v1/health')
        .set('Origin', 'https://otro.example.com');
      expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('errores de dominio', () => {
    it.each([
      [TipoErrorDominio.VALIDACION, 400],
      [TipoErrorDominio.NO_AUTENTICADO, 401],
      [TipoErrorDominio.NO_AUTORIZADO, 403],
      [TipoErrorDominio.NO_ENCONTRADO, 404],
      [TipoErrorDominio.CONFLICTO, 409],
      [TipoErrorDominio.REGLA_NEGOCIO, 422],
    ])('%s → %i con su mensaje', async (tipo, estado) => {
      const respuesta = await request(servidor())
        .get(`/api/v1/prueba/errores/${tipo}`)
        .expect(estado);
      expect(respuesta.body).toEqual({
        success: false,
        data: null,
        message: `Mensaje de ${tipo}`,
      });
    });

    it('un error no controlado → 500 genérico, sin el detalle, y el detalle va al log', async () => {
      const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const respuesta = await request(servidor()).get('/api/v1/prueba/falla').expect(500);
      expect(respuesta.body).toEqual({
        success: false,
        data: null,
        message: 'Error interno del servidor',
      });
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('detalle interno con datos sensibles'),
      );
      log.mockRestore();
    });
  });

  describe('validación', () => {
    it('acepta un cuerpo válido', async () => {
      const respuesta = await request(servidor())
        .post('/api/v1/prueba/cosas')
        .send({ nombre: 'Uno', direccion: { ciudad: 'Guayaquil' } })
        .expect(201);
      expect(respuesta.body.data).toEqual({
        nombre: 'Uno',
        direccion: { ciudad: 'Guayaquil' },
      });
    });

    // Los decoradores se evalúan de abajo hacia arriba y se detiene en el primer error:
    // el de tipo (abajo) es el que ve quien no manda el campo o manda otro tipo.
    it.each([
      ['ausente', undefined, 'El nombre es obligatorio y debe ser texto'],
      ['null', null, 'El nombre es obligatorio y debe ser texto'],
      ['de otro tipo', 5, 'El nombre es obligatorio y debe ser texto'],
      ['vacío', '', 'El nombre no puede estar vacío'],
      ['muy largo', 'x'.repeat(21), 'El nombre admite hasta 20 caracteres'],
    ])(
      'nombre %s → 400 con el mensaje en español del decorador',
      async (_caso, nombre, mensaje) => {
        const respuesta = await request(servidor())
          .post('/api/v1/prueba/cosas')
          .send({ nombre, direccion: { ciudad: 'Guayaquil' } })
          .expect(400);
        expect(respuesta.body).toEqual({
          success: false,
          data: null,
          message: mensaje,
        });
      },
    );

    it('revisa los objetos anidados', async () => {
      const respuesta = await request(servidor())
        .post('/api/v1/prueba/cosas')
        .send({ nombre: 'Uno', direccion: {} })
        .expect(400);
      expect(respuesta.body.message).toBe('La ciudad es obligatoria y debe ser texto');
    });

    it('rechaza un campo que el DTO no declara', async () => {
      const respuesta = await request(servidor())
        .post('/api/v1/prueba/cosas')
        .send({
          nombre: 'Uno',
          direccion: { ciudad: 'Guayaquil' },
          esAdmin: true,
        })
        .expect(400);
      expect(respuesta.body.message).toBe('El campo esAdmin no está permitido');
    });

    it('rechaza un campo no declarado dentro de un objeto anidado', async () => {
      const respuesta = await request(servidor())
        .post('/api/v1/prueba/cosas')
        .send({ nombre: 'Uno', direccion: { ciudad: 'Guayaquil', calle: 'X' } })
        .expect(400);
      expect(respuesta.body.message).toBe('El campo direccion.calle no está permitido');
    });

    it('convierte los números de la query con @Type', async () => {
      const respuesta = await request(servidor()).get('/api/v1/prueba/cosas?pagina=2').expect(200);
      expect(respuesta.body.data).toEqual({ pagina: 2, tipo: 'number' });
    });

    it('valida la query', async () => {
      const respuesta = await request(servidor()).get('/api/v1/prueba/cosas?pagina=0').expect(400);
      expect(respuesta.body.message).toBe('La página empieza en 1');
    });
  });

  describe('carácter nulo', () => {
    it('en el cuerpo → 400 con el campo', async () => {
      const respuesta = await request(servidor())
        .post('/api/v1/prueba/cosas')
        .send({ nombre: 'Uno', direccion: { ciudad: 'Guaya\u0000quil' } })
        .expect(400);
      expect(respuesta.body).toEqual({
        success: false,
        data: null,
        message: 'El campo direccion.ciudad tiene un carácter no permitido',
      });
    });

    it('en la query → 400', async () => {
      const respuesta = await request(servidor())
        .get('/api/v1/prueba/cosas?pagina=1%00')
        .expect(400);
      expect(respuesta.body.message).toBe('El campo pagina tiene un carácter no permitido');
    });

    it('en un parámetro de la ruta → 400', async () => {
      const respuesta = await request(servidor()).get('/api/v1/prueba/cosas/abc%00').expect(400);
      expect(respuesta.body.message).toBe('El campo id tiene un carácter no permitido');
    });
  });

  describe('ID_PIPE', () => {
    it('acepta un UUID', async () => {
      const id = '019a5c3e-7b2a-7c4d-8e9f-0123456789ab';
      const respuesta = await request(servidor()).get(`/api/v1/prueba/cosas/${id}`).expect(200);
      expect(respuesta.body.data).toEqual({ id });
    });

    it('un id mal escrito → 400 "El id no es válido"', async () => {
      const respuesta = await request(servidor()).get('/api/v1/prueba/cosas/123').expect(400);
      expect(respuesta.body).toEqual({
        success: false,
        data: null,
        message: 'El id no es válido',
      });
    });
  });

  describe('errores de NestJS y Express, en español', () => {
    it('ruta que no existe → 404', async () => {
      const respuesta = await request(servidor()).get('/api/v1/no-existe').expect(404);
      expect(respuesta.body).toEqual({
        success: false,
        data: null,
        message: 'La ruta solicitada no existe',
      });
    });

    it('JSON mal escrito → 400', async () => {
      const respuesta = await request(servidor())
        .post('/api/v1/prueba/cosas')
        .set('Content-Type', 'application/json')
        .send('{"nombre": ')
        .expect(400);
      expect(respuesta.body).toEqual({
        success: false,
        data: null,
        message: 'La solicitud está mal formada',
      });
    });

    it('cuerpo demasiado grande → 413', async () => {
      const respuesta = await request(servidor())
        .post('/api/v1/prueba/cosas')
        .send({
          nombre: 'x'.repeat(200_000),
          direccion: { ciudad: 'Guayaquil' },
        })
        .expect(413);
      expect(respuesta.body.message).toBe('El contenido enviado es demasiado grande');
    });
  });
});
