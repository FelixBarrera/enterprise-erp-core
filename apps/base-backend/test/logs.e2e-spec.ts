import { Controller, Get, Inject, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Writable } from 'node:stream';
import request from 'supertest';
import {
  CONTEXTO_PETICION_PORT,
  type ContextoPeticionPort,
} from '../src/shared/application/ports/contexto-peticion.port.js';
import { Publico } from '../src/shared/infrastructure/http/acceso/acceso.decorators.js';
import { ok } from '../src/shared/infrastructure/http/respuesta-api.js';
import { DESTINO_LOGS } from '../src/shared/infrastructure/logger/logs.module.js';
import { crearApp } from './utilidades/crear-app.js';

/** Controller solo de prueba. */
@Controller('prueba-logs')
class PruebaLogsController {
  private readonly logger = new Logger('PruebaLogs');

  constructor(@Inject(CONTEXTO_PETICION_PORT) private readonly contexto: ContextoPeticionPort) {}

  @Get('contexto')
  @Publico()
  verContexto() {
    this.logger.log({ contrasena: 'no-debe-salir', usuario: 'ana' }, 'Dentro de la petición');
    return ok(
      {
        requestId: this.contexto.requestId(),
        ip: this.contexto.ip(),
        navegador: this.contexto.navegador(),
      },
      'Contexto',
    );
  }

  @Get('falla')
  @Publico()
  fallar(): never {
    throw new Error('detalle interno que solo va al log');
  }
}

interface LineaLog {
  level: number;
  msg: string;
  requestId?: string;
  mensajeUsuario?: string;
  context?: string;
  [clave: string]: unknown;
}

// Niveles de pino.
const INFO = 30;
const WARN = 40;
const ERROR = 50;

describe('Logs y contexto de la petición (e2e)', () => {
  let app: NestExpressApplication;
  const lineas: string[] = [];
  const destino = new Writable({
    write(trozo: Buffer, _codificacion, listo) {
      lineas.push(...trozo.toString().split('\n').filter(Boolean));
      listo();
    },
  });
  const logs = (): LineaLog[] => lineas.map((linea) => JSON.parse(linea) as LineaLog);
  const deLaPeticion = (id: string) => logs().filter((linea) => linea.requestId === id);

  beforeAll(async () => {
    app = await crearApp({
      controllers: [PruebaLogsController],
      sobrescribir: (builder) =>
        builder.overrideProvider(DESTINO_LOGS).useValue({ destino, nivel: 'info' }),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    lineas.length = 0;
  });

  it('cada respuesta trae su número de petición en x-request-id', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(respuesta.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('usa el número que llegó si es válido, y lo reemplaza si no', async () => {
    const valido = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'abc12345-de-nginx');
    expect(valido.headers['x-request-id']).toBe('abc12345-de-nginx');

    const invalido = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'malo con espacios');
    expect(invalido.headers['x-request-id']).not.toBe('malo con espacios');
  });

  it('/health no deja línea en el log', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(logs()).toEqual([]);
  });

  it('una lectura que sale bien: una línea info, sin cabeceras ni cuerpo', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/prueba-logs/contexto')
      .set('Authorization', 'Bearer token-secreto')
      .set('Cookie', 'refresh=otro-secreto')
      .expect(200);
    const id = String(respuesta.headers['x-request-id']);
    const linea = deLaPeticion(id).find((l) => l.msg.startsWith('GET '));
    expect(linea).toMatchObject({
      level: INFO,
      msg: `GET /api/v1/prueba-logs/contexto → 200 (${String(linea?.['responseTime'])} ms) [req ${id.slice(0, 8)}]`,
    });
    const todo = lineas.join('\n');
    expect(todo).not.toContain('token-secreto');
    expect(todo).not.toContain('otro-secreto');
  });

  it('el caso de uso recibe el número de petición, la IP y el navegador', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/prueba-logs/contexto')
      .set('User-Agent', 'Navegador de prueba')
      .expect(200);
    expect(respuesta.body.data).toEqual({
      requestId: respuesta.headers['x-request-id'],
      ip: expect.any(String),
      navegador: 'Navegador de prueba',
    });
  });

  it('lo que escribe el código dentro de una petición lleva su número y oculta lo sensible', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/prueba-logs/contexto')
      .expect(200);
    const id = String(respuesta.headers['x-request-id']);
    const linea = deLaPeticion(id).find((l) => l.msg === 'Dentro de la petición');
    expect(linea).toMatchObject({ context: 'PruebaLogs', contrasena: '[OCULTO]', usuario: 'ana' });
  });

  it('un 4xx: warn, con el mensaje que vio el usuario', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/no-existe').expect(404);
    const [linea] = deLaPeticion(String(respuesta.headers['x-request-id']));
    expect(linea).toMatchObject({
      level: WARN,
      mensajeUsuario: 'La ruta solicitada no existe',
    });
  });

  it('un JSON mal escrito también queda en el log (antes de leer el cuerpo)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/prueba-logs/contexto')
      .set('Content-Type', 'application/json')
      .send('{mal')
      .expect(400);
    const [linea] = deLaPeticion(String(respuesta.headers['x-request-id']));
    expect(linea).toMatchObject({ level: WARN, mensajeUsuario: 'La solicitud está mal formada' });
  });

  it('un 500: error con el detalle en el log, y el usuario solo ve el mensaje genérico', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/prueba-logs/falla')
      .expect(500);
    expect(respuesta.body.message).toBe('Error interno del servidor');
    const id = String(respuesta.headers['x-request-id']);
    const delaPeticion = deLaPeticion(id);
    expect(delaPeticion.find((l) => l.msg.startsWith('GET '))).toMatchObject({
      level: ERROR,
      mensajeUsuario: 'Error interno del servidor',
    });
    expect(
      delaPeticion.some(
        (l) =>
          l.level === ERROR && JSON.stringify(l).includes('detalle interno que solo va al log'),
      ),
    ).toBe(true);
  });

  it('fuera de una petición, el contexto es null', () => {
    const contexto = app.get<ContextoPeticionPort>(CONTEXTO_PETICION_PORT);
    expect(contexto.requestId()).toBeNull();
    expect(contexto.ip()).toBeNull();
  });
});
