import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Redis } from 'ioredis';
import request from 'supertest';
import {
  CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
  type CrearEmpresaConAdministradorPort,
} from '../src/modules/auth/application/ports/in/crear-empresa-con-administrador.port.js';
import { actorDelSistema } from '../src/shared/application/actor.js';
import { AlmacenLimiteRedis } from '../src/shared/infrastructure/limite/almacen-limite.redis.js';
import {
  ALMACEN_LIMITE,
  OPCIONES_LIMITE,
  type OpcionesLimite,
} from '../src/shared/infrastructure/limite/opciones-limite.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import {
  CONEXION_REDIS,
  crearConexionRedis,
} from '../src/shared/infrastructure/redis/conexion-redis.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd } from './utilidades/limpiar-bd.js';
import { vaciarLimites } from './utilidades/limpiar-redis.js';

const CONTRASENA = 'Margarita-Lunes-47';
const ORIGEN = 'http://localhost:4200';
const DEMASIADAS = 'Demasiadas peticiones; espere un momento e intente de nuevo';
/** Números chicos para llegar al límite rápido (los demás e2e usan 100000). */
const LIMITES: OpcionesLimite = { loginPorMinuto: 3, usuarioPorMinuto: 4, ipPorMinuto: 6 };

interface Respuesta {
  status: number;
  body: { success: boolean; data: unknown; message: string };
  headers: Record<string, string | undefined>;
}

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/** Límite de peticiones contra Redis de verdad (AUTH-D17). */
describe('Límite de peticiones (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let usuarioId: string;

  beforeAll(async () => {
    app = await crearApp({
      sobrescribir: (b) => b.overrideProvider(OPCIONES_LIMITE).useValue(LIMITES),
    });
    prisma = app.get(PrismaService);
    redis = app.get(CONEXION_REDIS);
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
    await vaciarLimites(redis);
    const creada = await app
      .get<CrearEmpresaConAdministradorPort>(CREAR_EMPRESA_CON_ADMINISTRADOR_PORT)
      .crear(
        {
          nombreEmpresa: 'Comercial del Sur',
          administrador: {
            tipo: 'nuevo',
            nombreUsuario: 'ana',
            nombreCompleto: 'Ana Pérez',
            contrasena: CONTRASENA,
          },
        },
        actorDelSistema({ nombreUsuario: 'admin:crear-empresa' }),
      );
    usuarioId = creada.administrador.id;
  });

  afterAll(async () => {
    await vaciarLimites(redis);
    await app.close();
  });

  const servidor = () => app.getHttpServer() as Parameters<typeof request>[0];
  const login = (contrasena: string): Promise<Respuesta> =>
    request(servidor()).post('/api/v1/auth/login').send({ nombreUsuario: 'ana', contrasena });
  // GET /auth/sesion se puede usar con la contraseña temporal: no hace falta cambiarla.
  const verSesion = (token: string | null): Promise<Respuesta> => {
    const peticion = request(servidor()).get('/api/v1/auth/sesion');
    return token === null ? peticion : peticion.set('Authorization', `Bearer ${token}`);
  };

  it('login: al pasarse de los intentos por IP, 429 en español con Retry-After, sin tocar la cuenta', async () => {
    for (let i = 0; i < LIMITES.loginPorMinuto; i++) {
      expect((await login('Otra-Contrasena-99')).status).toBe(401);
    }

    const pasada = await login(CONTRASENA);

    expect(pasada.status).toBe(429);
    expect(pasada.body).toEqual({ success: false, data: null, message: DEMASIADAS });
    const espera = Number(pasada.headers['retry-after']);
    expect(espera).toBeGreaterThanOrEqual(1);
    expect(espera).toBeLessThanOrEqual(60);
    // El 429 no llega al caso de uso: no suma un intento fallido.
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.intentosFallidos).toBe(LIMITES.loginPorMinuto);
  });

  it('con sesión cuenta por usuario (corre después del guard de sesión)', async () => {
    const entrada = await login(CONTRASENA);
    expect(entrada.status).toBe(200);
    const token = (entrada.body.data as { tokenAcceso: string }).tokenAcceso;

    for (let i = 0; i < LIMITES.usuarioPorMinuto; i++) {
      expect((await verSesion(token)).status).toBe(200);
    }
    // Por IP aún quedaría cupo (1 login + 4 < 6): el 429 es del límite por usuario.
    const pasada = await verSesion(token);
    expect(pasada.status).toBe(429);
    expect(pasada.body.message).toBe(DEMASIADAS);
    await expect(redis.pttl(`limite:usuario:${usuarioId}`)).resolves.toBeGreaterThan(0);
  });

  it('una ruta con sesión sin token responde 401 y no cuenta', async () => {
    for (let i = 0; i < LIMITES.ipPorMinuto + 2; i++) {
      expect((await verSesion(null)).status).toBe(401);
    }
  });

  it('sin sesión cuenta por IP en toda la API (refresh y login suman juntos)', async () => {
    const refresh = () => request(servidor()).post('/api/v1/auth/refresh').set('Origin', ORIGEN);
    expect((await login('Otra-Contrasena-99')).status).toBe(401);
    for (let i = 1; i < LIMITES.ipPorMinuto; i++) {
      expect((await refresh()).status).toBe(401);
    }

    expect((await refresh()).status).toBe(429);
  });

  it('/health no tiene límite', async () => {
    for (let i = 0; i < LIMITES.ipPorMinuto * 3; i++) {
      expect((await request(servidor()).get('/api/v1/health')).status).toBe(200);
    }
  });

  it('el contador en Redis: atómico, con prefijo de la base, bloquea y se libera solo', async () => {
    const almacen = app.get<AlmacenLimiteRedis>(ALMACEN_LIMITE);
    const contar = () => almacen.increment('ip:prueba', 300, 2, 300);

    // A la vez: ninguna se pierde.
    const juntas = await Promise.all([contar(), contar()]);
    expect(juntas.map((r) => r.totalHits).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(redis.options.keyPrefix).toMatch(/_test:$/);
    await expect(redis.keys(`${redis.options.keyPrefix ?? ''}limite:ip:prueba*`)).resolves.toEqual([
      `${redis.options.keyPrefix ?? ''}limite:ip:prueba`,
    ]);

    await expect(contar()).resolves.toMatchObject({ totalHits: 3, isBlocked: true });
    // Mientras está bloqueado no sigue contando.
    await expect(contar()).resolves.toMatchObject({ totalHits: 3, isBlocked: true });

    await esperar(400);
    await expect(contar()).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
  });
});

describe('Límite de peticiones con Redis caído (e2e)', () => {
  let app: NestExpressApplication;
  let caida: Redis;

  beforeAll(async () => {
    // Un puerto donde no hay nadie: cada orden falla enseguida.
    caida = crearConexionRedis({ url: 'redis://127.0.0.1:1', prefijo: 'base_erp_test:' });
    app = await crearApp({
      sobrescribir: (b) =>
        b
          .overrideProvider(OPCIONES_LIMITE)
          .useValue(LIMITES)
          .overrideProvider(CONEXION_REDIS)
          .useValue(caida),
    });
    await limpiarBd(app.get(PrismaService));
  });

  afterAll(async () => {
    await app.close();
  });

  it('deja pasar todo: el login responde como siempre', async () => {
    const servidor = app.getHttpServer() as Parameters<typeof request>[0];
    for (let i = 0; i < LIMITES.loginPorMinuto + 2; i++) {
      const respuesta = await request(servidor)
        .post('/api/v1/auth/login')
        .send({ nombreUsuario: 'nadie', contrasena: 'Otra-Contrasena-99' });
      expect(respuesta.status).toBe(401);
    }
  });
});
