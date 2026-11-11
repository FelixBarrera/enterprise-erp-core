import type { Request, Response } from 'express';
import { Writable } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import pino from 'pino';
import {
  crearOpcionesLogs,
  formatoDesarrollo,
  horaDelLog,
  ignorarPeticion,
  lineaDePeticion,
  nivelDePeticion,
} from './opciones-logs.js';

const peticion = (method: string, originalUrl: string, id: unknown = 'abc12345-6789') =>
  ({ method, originalUrl, url: originalUrl, id }) as unknown as Request;
const peticionSinId = (method: string, originalUrl: string) =>
  ({ method, originalUrl, url: originalUrl }) as unknown as Request;
const respuesta = (statusCode: number) => ({ statusCode, locals: {} }) as unknown as Response;

describe('lineaDePeticion', () => {
  it('método, ruta con query, estado, tiempo y número corto de la petición', () => {
    expect(lineaDePeticion(peticion('GET', '/api/v1/usuarios?pagina=2'), respuesta(401), 3.6)).toBe(
      'GET /api/v1/usuarios?pagina=2 → 401 (4 ms) [req abc12345]',
    );
  });

  it('sin número de petición, un signo de pregunta', () => {
    expect(lineaDePeticion(peticionSinId('GET', '/x'), respuesta(200), 1)).toBe(
      'GET /x → 200 (1 ms) [req ?]',
    );
  });
});

describe('nivelDePeticion', () => {
  it.each([
    ['production', 'GET', 500, 'error'],
    ['production', 'POST', 409, 'warn'],
    ['production', 'GET', 200, 'info'],
    ['production', 'POST', 201, 'info'],
    ['development', 'GET', 200, 'silent'], // las lecturas que salieron bien no se escriben
    ['development', 'HEAD', 200, 'silent'],
    ['development', 'GET', 404, 'warn'],
    ['development', 'POST', 201, 'info'],
    ['test', 'GET', 200, 'info'],
  ] as const)('%s: %s con %i → %s', (entorno, metodo, estado, nivel) => {
    expect(nivelDePeticion(entorno, peticion(metodo, '/x'), respuesta(estado))).toBe(nivel);
  });
});

describe('ignorarPeticion', () => {
  it('no registra /health (con o sin query)', () => {
    expect(ignorarPeticion(peticion('GET', '/api/v1/health'))).toBe(true);
    expect(ignorarPeticion(peticion('GET', '/api/v1/health?x=1'))).toBe(true);
  });

  it('registra todo lo demás, aunque se parezca', () => {
    expect(ignorarPeticion(peticion('GET', '/api/v1/healthy'))).toBe(false);
    expect(ignorarPeticion(peticion('GET', '/api/v1/usuarios'))).toBe(false);
  });
});

describe('horaDelLog', () => {
  it('muestra la hora de Guayaquil aunque el proceso esté en Nueva York', () => {
    // 2026-07-15 17:00 UTC = 13:00 en Nueva York (verano) = 12:00 en Guayaquil.
    expect(horaDelLog(Date.parse('2026-07-15T17:00:05Z'))).toBe('12:00:05');
  });
});

describe('crearOpcionesLogs', () => {
  it('en producción escribe JSON en la consola (sin formato legible)', () => {
    const opciones = crearOpcionesLogs({ entorno: 'production', nivel: 'info' });
    expect(Array.isArray(opciones)).toBe(false);
  });

  it('en desarrollo agrega el formato legible', () => {
    const opciones = crearOpcionesLogs({ entorno: 'development', nivel: 'info' });
    expect(Array.isArray(opciones)).toBe(true);
  });

  it('con un destino de prueba escribe ahí, con el nivel pedido', () => {
    const destino = new Writable({ write: (_c, _e, listo) => listo() });
    const opciones = crearOpcionesLogs({ entorno: 'development', nivel: 'debug', destino });
    expect(Array.isArray(opciones) && opciones[1]).toBe(destino);
    expect(Array.isArray(opciones) && opciones[0].level).toBe('debug');
  });
});

describe('formatoDesarrollo', () => {
  it('una línea legible con la hora de Guayaquil y, debajo, el mensaje que vio el usuario', async () => {
    let texto = '';
    const salida = new Writable({
      write: (trozo: Buffer, _c, listo) => {
        texto += trozo.toString();
        listo();
      },
    });
    const formato = formatoDesarrollo(salida);
    const logger = pino(
      { timestamp: () => `,"time":${Date.parse('2026-07-15T15:59:44Z')}` },
      formato,
    );
    logger.warn(
      { requestId: 'abc', mensajeUsuario: 'La ruta solicitada no existe' },
      'GET /api/v1/x → 404 (2 ms) [req abc12345]',
    );
    logger.info({ context: 'PrismaService' }, 'Conectado a la base de datos');
    await new Promise((listo) => setImmediate(listo));

    const sinColores = stripVTControlCharacters(texto);
    expect(sinColores).toContain(
      '[10:59:44] WARN: GET /api/v1/x → 404 (2 ms) [req abc12345]\n    La ruta solicitada no existe',
    );
    expect(sinColores).toContain('[10:59:44] INFO: (PrismaService) Conectado a la base de datos');
    expect(sinColores).not.toContain('requestId');
  });
});
