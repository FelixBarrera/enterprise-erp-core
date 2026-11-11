import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiOperation, ApiProperty } from '@nestjs/swagger';
import request from 'supertest';
import {
  Publico,
  RequierePermiso,
  SoloSesion,
} from '../src/shared/infrastructure/http/acceso/acceso.decorators.js';
import { ok } from '../src/shared/infrastructure/http/respuesta-api.js';
import { PaginacionQueryDto } from '../src/shared/infrastructure/http/paginacion-query.dto.js';
import {
  ApiRespuestaError,
  ApiRespuestaOk,
  ApiRespuestaPagina,
} from '../src/shared/infrastructure/http/swagger.decorators.js';
import { MARCA } from '../src/marca.js';
import { crearApp } from './utilidades/crear-app.js';

class ItemPruebaDto {
  @ApiProperty({ description: 'Nombre del ítem', example: 'Bono' })
  nombre: string;
}

/** Controller solo de prueba: usa los decoradores como lo haría un módulo. */
@Controller('prueba-swagger')
class PruebaSwaggerController {
  // ─── GET /api/v1/prueba-swagger — Listar ítems ───
  @Get()
  @Publico()
  @ApiOperation({ summary: 'Listar ítems' })
  @ApiRespuestaOk([ItemPruebaDto], 'Ítems')
  listar() {
    return ok([{ nombre: 'Bono' }], 'Ítems');
  }

  // ─── POST /api/v1/prueba-swagger — Crear un ítem ───
  @Post()
  @Publico()
  @ApiOperation({ summary: 'Crear un ítem' })
  @ApiRespuestaOk(ItemPruebaDto, 'Ítem creado', 201)
  @ApiRespuestaError(400, 'El nombre es obligatorio', 'El nombre es muy largo')
  @ApiRespuestaError(409, 'Ya existe un ítem con ese nombre')
  crear(@Body() _dto: ItemPruebaDto) {
    return ok({ nombre: 'Bono' }, 'Ítem creado');
  }

  // ─── GET /api/v1/prueba-swagger/con-sesion — Con sesión ───
  @Get('con-sesion')
  @SoloSesion()
  @ApiOperation({ summary: 'Con sesión' })
  @ApiRespuestaOk([ItemPruebaDto], 'Ítems')
  conSesion() {
    return ok([], 'Ítems');
  }

  // ─── GET /api/v1/prueba-swagger/con-permiso — Con permiso ───
  @Get('con-permiso')
  @RequierePermiso('auth.usuario.ver')
  @ApiOperation({ summary: 'Con permiso' })
  @ApiRespuestaOk([ItemPruebaDto], 'Ítems')
  conPermiso() {
    return ok([], 'Ítems');
  }

  // ─── GET /api/v1/prueba-swagger/paginado — Listar por páginas ───
  @Get('paginado')
  @Publico()
  @ApiOperation({ summary: 'Listar por páginas' })
  @ApiRespuestaPagina(ItemPruebaDto, 'Ítems')
  paginado(@Query() query: PaginacionQueryDto) {
    return ok({ elementos: [], total: 0, pagina: query.pagina, tamano: query.tamano }, 'Ítems');
  }
}

interface Esquema {
  type?: string;
  example?: unknown;
  enum?: unknown[];
  $ref?: string;
  items?: Esquema;
  properties?: Record<string, Esquema>;
}
interface Documento {
  info: { title: string };
  paths: Record<
    string,
    Record<
      string,
      {
        summary?: string;
        security?: unknown;
        parameters?: { name: string; in: string; required?: boolean }[];
        responses: Record<
          string,
          { description: string; content: { 'application/json': { schema: Esquema } } }
        >;
      }
    >
  >;
  components: { schemas: Record<string, Esquema>; securitySchemes?: Record<string, unknown> };
}

describe('Swagger (e2e)', () => {
  let app: NestExpressApplication;
  let documento: Documento;

  beforeAll(async () => {
    app = await crearApp({ controllers: [PruebaSwaggerController] });
    const respuesta = await request(app.getHttpServer()).get('/api/v1/docs-json').expect(200);
    documento = respuesta.body as Documento;
  });

  afterAll(async () => {
    await app.close();
  });

  const esquema = (ruta: string, metodo: string, estado: string): Esquema | undefined =>
    documento.paths[ruta]?.[metodo]?.responses[estado]?.content['application/json'].schema;

  it('publica la página en /api/v1/docs, con sus estilos y scripts', async () => {
    const pagina = await request(app.getHttpServer()).get('/api/v1/docs').expect(200);
    expect(pagina.headers['content-type']).toContain('text/html');
    expect(pagina.text).toContain(`<title>${MARCA.nombre}: API</title>`);
    for (const archivo of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-init.js']) {
      await request(app.getHttpServer()).get(`/api/v1/docs/${archivo}`).expect(200);
    }
  });

  it('fuera de producción, la página no obliga a https (si no, no cargaría por http)', async () => {
    const pagina = await request(app.getHttpServer()).get('/api/v1/docs').expect(200);
    expect(pagina.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(pagina.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it('el JSON tiene el título, el candado del login y las rutas con su prefijo', () => {
    expect(documento.info.title).toBe(`${MARCA.nombre}: API`);
    expect(documento.components.securitySchemes).toHaveProperty('bearer');
    expect(Object.keys(documento.paths)).toContain('/api/v1/health');
  });

  it('health: 200 con { success, data, message } y 503 documentados', () => {
    const exito = esquema('/api/v1/health', 'get', '200');
    expect(exito?.properties?.['data']).toEqual({
      $ref: '#/components/schemas/EstadoSaludRespuestaDto',
    });
    expect(exito?.properties?.['message']?.example).toBe('Servicio en marcha');
    expect(esquema('/api/v1/health', 'get', '503')?.properties?.['success']?.example).toBe(false);
  });

  it('@ApiRespuestaOk con una lista y con 201', () => {
    expect(esquema('/api/v1/prueba-swagger', 'get', '200')?.properties?.['data']).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/ItemPruebaDto' },
    });
    expect(esquema('/api/v1/prueba-swagger', 'post', '201')?.properties?.['message']?.example).toBe(
      'Ítem creado',
    );
  });

  it('@ApiRespuestaPagina y PaginacionQueryDto: la página en data y los dos parámetros', async () => {
    const data = esquema('/api/v1/prueba-swagger/paginado', 'get', '200')?.properties?.['data'];
    expect(data?.properties?.['elementos']).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/ItemPruebaDto' },
    });
    expect(Object.keys(data?.properties ?? {})).toEqual(['elementos', 'total', 'pagina', 'tamano']);
    const parametros = documento.paths['/api/v1/prueba-swagger/paginado']?.['get']?.parameters;
    expect(parametros?.map((p) => [p.name, p.in, p.required])).toEqual([
      ['pagina', 'query', false],
      ['tamano', 'query', false],
    ]);
    // Y por la API de verdad: sin parámetros, la primera de 20; uno mal, 400 en español.
    const respuesta = await request(app.getHttpServer()).get('/api/v1/prueba-swagger/paginado');
    expect(respuesta.body).toMatchObject({ data: { pagina: 1, tamano: 20 } });
    const mal = await request(app.getHttpServer()).get(
      '/api/v1/prueba-swagger/paginado?tamano=500',
    );
    expect(mal.status).toBe(400);
    expect((mal.body as { message: string }).message).toBe(
      'El tamaño de la página no puede pasar de 100',
    );
  });

  it('@ApiRespuestaError: un estado con varios mensajes, y varios estados', () => {
    const operacion = documento.paths['/api/v1/prueba-swagger']?.['post'];
    expect(operacion?.responses['400']?.description).toBe(
      'El nombre es obligatorio · El nombre es muy largo',
    );
    expect(esquema('/api/v1/prueba-swagger', 'post', '400')?.properties?.['message']?.enum).toEqual(
      ['El nombre es obligatorio', 'El nombre es muy largo'],
    );
    expect(esquema('/api/v1/prueba-swagger', 'post', '409')?.properties?.['data']).toEqual({
      type: 'null',
      example: null,
    });
  });

  it('@SoloSesion() y @RequierePermiso(): candado, 401 y el 403 de AUTH-D14 (sin él en las rutas que permite la contraseña temporal)', () => {
    const sesion = documento.paths['/api/v1/auth/sesion']?.['get'];
    expect(sesion?.security).toEqual([{ bearer: [] }]);
    expect(sesion?.responses['401']?.description).toBe('Su sesión terminó. Vuelva a ingresar.');
    expect(sesion?.responses['403']).toBeUndefined();
    const salir = documento.paths['/api/v1/auth/logout']?.['post'];
    expect(salir?.security).toEqual([{ bearer: [] }]);
    expect(salir?.responses['403']?.description).toBe('La petición no viene de un sitio permitido');
    expect(esquema('/api/v1/auth/logout', 'post', '200')?.properties?.['data']).toEqual({
      type: 'null',
      example: null,
    });

    const comun = documento.paths['/api/v1/prueba-swagger/con-sesion']?.['get'];
    expect(comun?.security).toEqual([{ bearer: [] }]);
    expect(comun?.responses['403']?.description).toBe(
      'Debe cambiar su contraseña antes de continuar',
    );
    const conPermiso = documento.paths['/api/v1/prueba-swagger/con-permiso']?.['get'];
    expect(conPermiso?.security).toEqual([{ bearer: [] }]);
    expect(conPermiso?.responses['401']?.description).toBe('Su sesión terminó. Vuelva a ingresar.');
    expect(conPermiso?.responses['403']?.description).toBe(
      'No tiene permiso para esta acción · Debe cambiar su contraseña antes de continuar',
    );
    // Las públicas, sin candado.
    expect(documento.paths['/api/v1/auth/login']?.['post']?.security).toBeUndefined();
    expect(documento.paths['/api/v1/health']?.['get']?.security).toBeUndefined();
  });

  it('los DTO describen sus campos en español', () => {
    expect(documento.components.schemas['ItemPruebaDto']?.properties?.['nombre']).toMatchObject({
      type: 'string',
      example: 'Bono',
    });
  });
});
