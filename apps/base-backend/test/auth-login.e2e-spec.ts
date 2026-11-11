import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
  type CrearEmpresaConAdministradorPort,
} from '../src/modules/auth/application/ports/in/crear-empresa-con-administrador.port.js';
import {
  GENERADOR_TOKENS_PORT,
  type GeneradorTokensPort,
} from '../src/modules/auth/application/ports/out/generador-tokens.port.js';
import {
  HASHER_CONTRASENA_PORT,
  type HasherContrasenaPort,
} from '../src/modules/auth/application/ports/out/hasher-contrasena.port.js';
import {
  DESACTIVAR_EMPRESA_PORT,
  type DesactivarEmpresaPort,
} from '../src/modules/empresas/application/ports/in/desactivar-empresa.port.js';
import { actorDelSistema } from '../src/shared/application/actor.js';
import { RELOJ_PORT } from '../src/shared/application/ports/reloj.port.js';
import { RelojFijo } from '../src/shared/application/testing/reloj-fijo.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import {
  derivarClaveRefresco,
  GeneradorTokensJwt,
} from '../src/modules/auth/infrastructure/adapters/out/jwt/generador-tokens.jwt.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd, vaciarAuditoria } from './utilidades/limpiar-bd.js';

const CONTRASENA = 'Margarita-Lunes-47';
const ORIGEN = 'http://localhost:4200';
const CREDENCIALES_INVALIDAS =
  'Credenciales inválidas. Si falló varias veces, espere 15 minutos o pida ayuda al administrador.';
const SESION_TERMINO = 'Su sesión terminó. Vuelva a ingresar.';

interface Respuesta {
  status: number;
  body: { success: boolean; data: unknown; message: string };
  headers: Record<string, string | string[] | undefined>;
}

/** Login, refresh y la tabla de sesiones contra la base real (QA-01). */
describe('Login y refresh (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let tokens: GeneradorTokensPort;
  const reloj = new RelojFijo('2026-07-15T08:00:00-05:00');
  let empresaId: string;
  let usuarioId: string;

  beforeAll(async () => {
    app = await crearApp({
      sobrescribir: (b) => b.overrideProvider(RELOJ_PORT).useValue(reloj),
    });
    prisma = app.get(PrismaService);
    tokens = app.get(GENERADOR_TOKENS_PORT);
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
    reloj.fijar('2026-07-15T08:00:00-05:00');
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
    empresaId = creada.empresa.id;
    usuarioId = creada.administrador.id;
    await vaciarAuditoria(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const servidor = () => app.getHttpServer() as Parameters<typeof request>[0];

  const login = (cuerpo: unknown): Promise<Respuesta> =>
    request(servidor())
      .post('/api/v1/auth/login')
      .set('User-Agent', 'Navegador e2e')
      .send(cuerpo as object);

  const refresh = (cookie: string | null, origen: string | null = ORIGEN): Promise<Respuesta> => {
    const peticion = request(servidor()).post('/api/v1/auth/refresh');
    if (origen !== null) {
      peticion.set('Origin', origen);
    }
    if (cookie !== null) {
      peticion.set('Cookie', `token_refresco=${cookie}`);
    }
    return peticion;
  };

  /** La cookie `token_refresco` que puso la respuesta (con sus atributos). */
  function cookieDe(respuesta: Respuesta): { valor: string; atributos: string } {
    const cabecera = respuesta.headers['set-cookie'];
    const lista = Array.isArray(cabecera) ? cabecera : cabecera === undefined ? [] : [cabecera];
    const cookie = lista.find((c) => c.startsWith('token_refresco='));
    if (cookie === undefined) {
      throw new Error('La respuesta no puso la cookie token_refresco');
    }
    const [par = '', ...resto] = cookie.split('; ');
    return {
      valor: decodeURIComponent(par.slice('token_refresco='.length)),
      atributos: resto.join('; '),
    };
  }

  const entrar = () => login({ nombreUsuario: 'ana', contrasena: CONTRASENA });
  const eventos = (accion: string) =>
    prisma.eventoAuditoria.findMany({ where: { accion }, orderBy: { ocurridoEn: 'asc' } });

  describe('POST /auth/login', () => {
    it('entra: access token en el cuerpo, refresh solo en la cookie, sesión y evento en la base', async () => {
      const respuesta = await entrar();

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        success: true,
        data: {
          tokenAcceso: expect.any(String),
          expiraEnSegundos: 900,
          debeCambiarContrasena: true,
        },
        message: 'Sesión iniciada',
      });
      const data = respuesta.body.data as { tokenAcceso: string };
      const { valor, atributos } = cookieDe(respuesta);
      expect(JSON.stringify(respuesta.body)).not.toContain(valor);
      expect(atributos).toContain('Path=/api/v1/auth');
      expect(atributos).toContain('HttpOnly');
      expect(atributos).toContain('Secure');
      expect(atributos).toContain('SameSite=Strict');
      // Vence con la sesión: 13 horas después (21:00 de Guayaquil = 02:00 UTC).
      expect(atributos).toContain('Expires=Thu, 16 Jul 2026 02:00:00 GMT');

      const [sid = '', secreto = ''] = valor.split('.');
      expect(await tokens.verificarAcceso(data.tokenAcceso)).toEqual({ usuarioId, sesionId: sid });
      const sesion = await prisma.sesion.findUniqueOrThrow({ where: { id: sid } });
      expect(sesion).toMatchObject({
        usuarioId,
        empresaId,
        // En la base, solo la huella del secreto.
        hashRefresh: createHash('sha256').update(secreto).digest('hex'),
        iniciadaEn: new Date('2026-07-15T13:00:00Z'),
        venceEn: new Date('2026-07-16T02:00:00Z'),
        cerradaEn: null,
        ip: expect.any(String),
        navegador: 'Navegador e2e',
      });
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
      expect(usuario).toMatchObject({ ultimaEmpresaId: empresaId, intentosFallidos: 0 });
      expect(usuario.ultimoIngresoEn).toEqual(new Date('2026-07-15T13:00:00Z'));

      const [evento] = await eventos('auth.sesion.iniciar');
      expect(evento).toMatchObject({
        empresaId,
        usuarioId,
        nombreUsuario: 'ana',
        entidad: 'sesion',
        entidadId: sid,
        navegador: 'Navegador e2e',
      });
      expect(JSON.stringify(evento)).not.toContain(secreto);
    });

    it('el nombre de usuario se acepta con mayúsculas y espacios alrededor', async () => {
      expect((await login({ nombreUsuario: '  ANA ', contrasena: CONTRASENA })).status).toBe(200);
    });

    it('cada fallo responde lo mismo y queda en la bitácora aunque la respuesta sea un error', async () => {
      const casos: [string, unknown][] = [
        ['no existe', { nombreUsuario: 'nadie', contrasena: CONTRASENA }],
        ['nombre imposible', { nombreUsuario: 'a b', contrasena: CONTRASENA }],
        ['contraseña mal', { nombreUsuario: 'ana', contrasena: 'otra-cosa-larga' }],
      ];
      for (const [, cuerpo] of casos) {
        const respuesta = await login(cuerpo);
        expect(respuesta.status).toBe(401);
        expect(respuesta.body).toEqual({
          success: false,
          data: null,
          message: CREDENCIALES_INVALIDAS,
        });
        expect(cookieDeOpcional(respuesta)).toBeNull();
      }
      const fallidos = await eventos('auth.sesion.fallido');
      expect(fallidos.map((e) => e.despues)).toEqual([
        { motivo: 'NO_EXISTE' },
        { motivo: 'NO_EXISTE' },
        { motivo: 'CONTRASENA_INCORRECTA', intentosFallidos: 1 },
      ]);
      // El de un usuario que no existe: sin empresa ni usuario, y sin lo que se escribió.
      expect(fallidos[0]).toMatchObject({ empresaId: null, usuarioId: null, nombreUsuario: null });
      expect(JSON.stringify(fallidos)).not.toContain('nadie');
      expect(await prisma.sesion.count()).toBe(0);
    });

    it('al quinto fallo bloquea 15 minutos: ni la contraseña correcta entra; después, sí', async () => {
      for (let i = 0; i < 5; i++) {
        await login({ nombreUsuario: 'ana', contrasena: 'otra-cosa-larga' });
      }
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
      expect(usuario.bloqueadoHasta).toEqual(new Date('2026-07-15T13:15:00Z'));
      expect(await eventos('auth.usuario.bloquear')).toHaveLength(1);

      const bloqueado = await entrar();
      expect(bloqueado.status).toBe(401);
      expect(bloqueado.body.message).toBe(CREDENCIALES_INVALIDAS);
      expect((await eventos('auth.sesion.fallido')).at(-1)?.despues).toEqual({
        motivo: 'BLOQUEADO',
        intentosFallidos: 0,
      });

      reloj.fijar('2026-07-15T08:15:00-05:00');
      expect((await entrar()).status).toBe(200);
    });

    it('desactivado: el mismo 401', async () => {
      await prisma.usuario.update({ where: { id: usuarioId }, data: { activo: false } });
      const respuesta = await entrar();
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.message).toBe(CREDENCIALES_INVALIDAS);
    });

    it('un usuario que no existe tarda parecido a uno que existe (siempre se verifica un hash)', async () => {
      const medir = async (cuerpo: unknown): Promise<number> => {
        const inicio = process.hrtime.bigint();
        await login(cuerpo);
        return Number(process.hrtime.bigint() - inicio) / 1e6;
      };
      const mediana = (valores: number[]) =>
        valores.sort((a, b) => a - b)[Math.floor(valores.length / 2)] ?? 0;
      // Sin que el usuario llegue al quinto fallo: el bloqueo suma escrituras y mueve la medición.
      const sinFallos = () =>
        prisma.usuario.update({ where: { id: usuarioId }, data: { intentosFallidos: 0 } });
      const hasher = app.get<HasherContrasenaPort>(HASHER_CONTRASENA_PORT);
      const rellenos = vi.spyOn(hasher, 'verificarRelleno');

      // Una vuelta de calentamiento, que no se cuenta: la primera calcula el hash de relleno y
      // prepara las conexiones.
      await medir({ nombreUsuario: 'ana', contrasena: 'otra-cosa-larga' });
      await medir({ nombreUsuario: 'nadie', contrasena: 'otra-cosa-larga' });
      const existe: number[] = [];
      const noExiste: number[] = [];
      for (let i = 0; i < 7; i++) {
        await sinFallos();
        existe.push(await medir({ nombreUsuario: 'ana', contrasena: 'otra-cosa-larga' }));
        noExiste.push(await medir({ nombreUsuario: 'nadie', contrasena: 'otra-cosa-larga' }));
      }

      // Lo seguro, sin depender de la velocidad de la máquina: cada usuario que no existe pasó
      // por el hash de relleno.
      expect(rellenos).toHaveBeenCalledTimes(8);
      rellenos.mockRestore();
      // Y el tiempo: sin el hash de relleno, el que no existe tarda la tercera parte (solo HTTP,
      // base y bitácora, sin Argon2): comprobado al escribir la prueba (11 ms contra 36 ms). La
      // mediana de 7 aguanta un par de mediciones lentas del CI (6.13a: falló una vez con 3).
      expect(mediana(noExiste)).toBeGreaterThan(mediana(existe) / 2);
    });

    it('con la contraseña correcta pero sin empresa activa: 403, y queda en la bitácora de su última empresa sin sumar al bloqueo (AUTH-D16, AUD-01)', async () => {
      expect((await entrar()).status).toBe(200);
      await app
        .get<DesactivarEmpresaPort>(DESACTIVAR_EMPRESA_PORT)
        .desactivar(empresaId, actorDelSistema({ nombreUsuario: 'admin:desactivar-empresa' }));
      await prisma.sesion.deleteMany();
      await vaciarAuditoria(prisma);

      const respuesta = await entrar();

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.message).toBe(
        'Su usuario no tiene acceso a ninguna empresa. Pida ayuda al administrador.',
      );
      expect(await prisma.sesion.count()).toBe(0);
      const [evento, ...otros] = await prisma.eventoAuditoria.findMany();
      expect(otros).toEqual([]);
      expect(evento).toMatchObject({
        accion: 'auth.sesion.fallido',
        empresaId,
        usuarioId,
        entidad: 'usuario',
        entidadId: usuarioId,
        entidadNombre: 'ana',
        despues: { motivo: 'SIN_EMPRESA' },
      });
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
      expect(usuario.intentosFallidos).toBe(0);
      expect(usuario.bloqueadoHasta).toBeNull();
    });

    it.each([
      ['sin cuerpo', {}, 'El nombre de usuario es obligatorio y debe ser texto'],
      [
        'usuario null',
        { nombreUsuario: null, contrasena: 'x' },
        'El nombre de usuario es obligatorio y debe ser texto',
      ],
      [
        'usuario vacío',
        { nombreUsuario: '', contrasena: 'x' },
        'El nombre de usuario es obligatorio',
      ],
      [
        'usuario número',
        { nombreUsuario: 7, contrasena: 'x' },
        'El nombre de usuario es obligatorio y debe ser texto',
      ],
      [
        'contraseña ausente',
        { nombreUsuario: 'ana' },
        'La contraseña es obligatoria y debe ser texto',
      ],
      [
        'contraseña vacía',
        { nombreUsuario: 'ana', contrasena: '' },
        'La contraseña es obligatoria',
      ],
      [
        'contraseña enorme',
        { nombreUsuario: 'ana', contrasena: 'x'.repeat(1001) },
        'La contraseña es demasiado larga',
      ],
      ['campo de más', { nombreUsuario: 'ana', contrasena: 'x', rol: 'admin' }, null],
    ])('400 %s, sin tocar la base', async (_caso, cuerpo, mensaje) => {
      const respuesta = await login(cuerpo);
      expect(respuesta.status).toBe(400);
      if (mensaje !== null) {
        expect(respuesta.body.message).toContain(mensaje);
      }
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });
  });

  describe('POST /auth/refresh', () => {
    async function iniciada(): Promise<string> {
      return cookieDe(await entrar()).valor;
    }

    it('con la cookie y el Origin permitido: tokens nuevos y otra cookie', async () => {
      const cookie = await iniciada();
      reloj.avanzarMinutos(14);

      const respuesta = await refresh(cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toMatchObject({
        success: true,
        data: { expiraEnSegundos: 900, debeCambiarContrasena: true },
        message: 'Sesión renovada',
      });
      const nueva = cookieDe(respuesta);
      expect(nueva.valor).not.toBe(cookie);
      expect(nueva.valor.split('.')[0]).toBe(cookie.split('.')[0]);
      expect(nueva.atributos).toContain('HttpOnly');
      const sesion = await prisma.sesion.findFirstOrThrow();
      expect(sesion.ultimoUsoEn).toEqual(new Date('2026-07-15T13:14:00Z'));
      expect(sesion.hashRefreshAnterior).not.toBeNull();
    });

    it('dos refresh a la vez con la misma cookie: los dos salen bien (uno espera al otro)', async () => {
      const cookie = await iniciada();

      const [a, b] = await Promise.all([refresh(cookie), refresh(cookie)]);

      expect([a.status, b.status]).toEqual([200, 200]);
      expect((await prisma.sesion.findFirstOrThrow()).cerradaEn).toBeNull();
    });

    it('la cookie anterior vale 60 s; después es reuso: cierra todas sus sesiones y lo registra', async () => {
      const cookie = await iniciada();
      const otra = await iniciada();
      await refresh(cookie);

      reloj.fijar('2026-07-15T08:01:00-05:00');
      const dentro = await refresh(cookie);
      expect(dentro.status).toBe(200);

      reloj.fijar('2026-07-15T08:02:01-05:00');
      const reuso = await refresh(cookie);
      expect(reuso.status).toBe(401);
      expect(reuso.body.message).toBe(SESION_TERMINO);
      expect(cookieDe(reuso).atributos).toContain('Expires=Thu, 01 Jan 1970');

      const sesiones = await prisma.sesion.findMany();
      expect(sesiones.map((s) => s.motivoCierre)).toEqual(['REUSO', 'REUSO']);
      const [evento] = await eventos('auth.sesion.reuso');
      expect(evento).toMatchObject({ empresaId, usuarioId, despues: { sesionesCerradas: 2 } });
      // La otra sesión del usuario tampoco sirve ya.
      expect((await refresh(otra)).status).toBe(401);
    });

    it('sin uso por 120 minutos: 401 y borra la cookie', async () => {
      const cookie = await iniciada();
      reloj.fijar('2026-07-15T10:00:00-05:00');

      const respuesta = await refresh(cookie);

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.message).toBe(SESION_TERMINO);
      expect(cookieDe(respuesta).valor).toBe('');
    });

    it('al llegar al máximo de la jornada: 401 aunque se use sin parar', async () => {
      let cookie = await iniciada();
      for (let hora = 1; hora <= 12; hora++) {
        reloj.fijar(`2026-07-15T${String(8 + hora).padStart(2, '0')}:59:00-05:00`);
        const respuesta = await refresh(cookie);
        expect(respuesta.status).toBe(200);
        cookie = cookieDe(respuesta).valor;
      }
      reloj.fijar('2026-07-15T21:00:00-05:00');
      expect((await refresh(cookie)).status).toBe(401);
    });

    it('sin cookie o con una inventada: 401', async () => {
      expect((await refresh(null)).status).toBe(401);
      expect((await refresh('basura')).status).toBe(401);
      const sid = '0190a4f2-1c2b-7000-8000-000000000999';
      expect((await refresh(`${sid}.${'x'.repeat(43)}`)).status).toBe(401);
      expect((await refresh(`${sid}.${'x'.repeat(43)}.${'y'.repeat(43)}`)).status).toBe(401);
    });

    it('SEG-05: una cookie inventada con el sid real (se ve en la ficha y en la bitácora) da 401 y no cierra nada', async () => {
      const cookie = await iniciada();
      const otra = await iniciada();
      const [sid = '', secreto = '', firma = ''] = cookie.split('.');
      const inventadas = [
        `${sid}.${'x'.repeat(43)}`, // la forma de antes, sin firma
        `${sid}.${'x'.repeat(43)}.${'y'.repeat(43)}`, // secreto y firma inventados
        `${sid}.${'x'.repeat(43)}.${firma}`, // la firma de verdad con otro secreto
        `${sid}.${secreto}.${otra.split('.')[2] ?? ''}`, // la firma de otra sesión
        // Firmada con una clave que no es la del servidor.
        new GeneradorTokensJwt(
          new JwtService({ secret: 'x'.repeat(64) }),
          reloj,
          derivarClaveRefresco('una-clave-que-no-es-la-del-servidor-'.repeat(2)),
        ).armarRefresco({ sesionId: sid, secreto: 'x'.repeat(43) }),
      ];

      for (const inventada of inventadas) {
        const respuesta = await refresh(inventada);
        expect(respuesta.status).toBe(401);
        expect(respuesta.body.message).toBe(SESION_TERMINO);
      }

      const sesiones = await prisma.sesion.findMany();
      expect(sesiones.map((s) => s.cerradaEn)).toEqual([null, null]);
      expect(await eventos('auth.sesion.reuso')).toEqual([]);
      // Las dos cookies de verdad siguen sirviendo.
      expect((await refresh(cookie)).status).toBe(200);
      expect((await refresh(otra)).status).toBe(200);
    });

    it('sin Origin o desde otro sitio: 403, sin tocar la sesión (CSRF)', async () => {
      const cookie = await iniciada();
      const antes = await prisma.sesion.findFirstOrThrow();

      for (const origen of [null, 'https://malo.test']) {
        const respuesta = await refresh(cookie, origen);
        expect(respuesta.status).toBe(403);
        expect(respuesta.body.message).toBe('La petición no viene de un sitio permitido');
      }
      expect(await prisma.sesion.findFirstOrThrow()).toEqual(antes);
      expect((await refresh(cookie)).status).toBe(200);
    });

    it('usuario desactivado: 401 (empresa desactivada y sin roles: en los unitarios)', async () => {
      const cookie = await iniciada();
      await prisma.usuario.update({ where: { id: usuarioId }, data: { activo: false } });
      expect((await refresh(cookie)).status).toBe(401);
    });
  });
});

function cookieDeOpcional(respuesta: Respuesta): string | null {
  const cabecera = respuesta.headers['set-cookie'];
  const lista = Array.isArray(cabecera) ? cabecera : cabecera === undefined ? [] : [cabecera];
  return lista.find((c) => c.startsWith('token_refresco=')) ?? null;
}
