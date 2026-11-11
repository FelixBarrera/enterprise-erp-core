import { Controller, Get } from '@nestjs/common';
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
import { type Actor, actorDelSistema } from '../src/shared/application/actor.js';
import { RELOJ_PORT } from '../src/shared/application/ports/reloj.port.js';
import { RelojFijo } from '../src/shared/application/testing/reloj-fijo.js';
import { Publico, SoloSesion } from '../src/shared/infrastructure/http/acceso/acceso.decorators.js';
import { UsuarioActual } from '../src/shared/infrastructure/http/acceso/sesion-de-peticion.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { ok } from '../src/shared/infrastructure/http/respuesta-api.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd, vaciarAuditoria } from './utilidades/limpiar-bd.js';

const CONTRASENA = 'Margarita-Lunes-47';
const ORIGEN = 'http://localhost:4200';
const SESION_TERMINO = 'Su sesión terminó. Vuelva a ingresar.';
const DEBE_CAMBIAR = 'Debe cambiar su contraseña antes de continuar';

/** Una ruta común de un módulo cualquiera: con sesión y sin contraseña temporal. */
@Controller('prueba-acceso')
class PruebaAccesoController {
  @Get()
  @SoloSesion()
  quienSoy(@UsuarioActual() actor: Actor) {
    return ok(actor, 'Actor');
  }
}

@Controller('prueba-sin-regla')
class SinReglaController {
  @Get()
  olvidada() {
    return ok(null, 'Nadie la protegió');
  }
}

@Controller('prueba-dos-reglas')
class DosReglasController {
  @Get()
  @Publico()
  @SoloSesion()
  confusa() {
    return ok(null, 'Dos reglas');
  }
}

interface Respuesta {
  status: number;
  body: { success: boolean; data: unknown; message: string };
  headers: Record<string, string | string[] | undefined>;
}

/** Guard global, GET /auth/sesion y logout contra la base real (QA-01, QA-02). */
describe('Guard y sesión (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let tokens: GeneradorTokensPort;
  const reloj = new RelojFijo('2026-07-15T08:00:00-05:00');
  let sur: { empresaId: string; anaId: string };
  let zeta: { empresaId: string; betoId: string };

  beforeAll(async () => {
    app = await crearApp({
      controllers: [PruebaAccesoController],
      sobrescribir: (b) => b.overrideProvider(RELOJ_PORT).useValue(reloj),
    });
    prisma = app.get(PrismaService);
    tokens = app.get(GENERADOR_TOKENS_PORT);
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
    reloj.fijar('2026-07-15T08:00:00-05:00');
    const crear = app.get<CrearEmpresaConAdministradorPort>(CREAR_EMPRESA_CON_ADMINISTRADOR_PORT);
    const actor = actorDelSistema({ nombreUsuario: 'admin:crear-empresa' });
    const a = await crear.crear(
      {
        nombreEmpresa: 'Comercial del Sur',
        administrador: {
          tipo: 'nuevo',
          nombreUsuario: 'ana',
          nombreCompleto: 'Ana Pérez',
          contrasena: CONTRASENA,
        },
      },
      actor,
    );
    const z = await crear.crear(
      {
        nombreEmpresa: 'Zeta Servicios',
        administrador: {
          tipo: 'nuevo',
          nombreUsuario: 'beto',
          nombreCompleto: 'Beto Ruiz',
          contrasena: CONTRASENA,
        },
      },
      actor,
    );
    sur = { empresaId: a.empresa.id, anaId: a.administrador.id };
    zeta = { empresaId: z.empresa.id, betoId: z.administrador.id };
    // Beto también trabaja en Comercial del Sur, como Operador (sin ser administrador).
    const operador = await prisma.rol.create({
      data: { empresaId: sur.empresaId, nombre: 'Operador' },
    });
    await prisma.usuarioRol.create({
      data: { usuarioId: zeta.betoId, empresaId: sur.empresaId, rolId: operador.id },
    });
    // Los comandos dejan la contraseña como temporal: aquí ya la cambiaron (AUTH-D14 aparte).
    await prisma.usuario.updateMany({ data: { debeCambiarContrasena: false } });
    await vaciarAuditoria(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const servidor = () => app.getHttpServer() as Parameters<typeof request>[0];

  /** Entra y devuelve el access token y el refresh de la cookie. */
  async function entrar(nombreUsuario = 'ana'): Promise<{ acceso: string; refresco: string }> {
    const respuesta = (await request(servidor())
      .post('/api/v1/auth/login')
      .send({ nombreUsuario, contrasena: CONTRASENA })) as Respuesta;
    expect(respuesta.status).toBe(200);
    const cabecera = respuesta.headers['set-cookie'];
    const cookies = Array.isArray(cabecera) ? cabecera : [cabecera ?? ''];
    const cookie = cookies.find((c) => c.startsWith('token_refresco=')) ?? '';
    return {
      acceso: (respuesta.body.data as { tokenAcceso: string }).tokenAcceso,
      refresco: decodeURIComponent(cookie.split(';')[0]?.slice('token_refresco='.length) ?? ''),
    };
  }

  const conToken = (ruta: string, token: string | null): Promise<Respuesta> => {
    const peticion = request(servidor()).get(ruta).set('User-Agent', 'Navegador e2e');
    if (token !== null) {
      peticion.set('Authorization', `Bearer ${token}`);
    }
    return peticion;
  };
  const verSesion = (token: string | null) => conToken('/api/v1/auth/sesion', token);
  const rutaComun = (token: string | null) => conToken('/api/v1/prueba-acceso', token);

  const salir = (token: string, refresco: string, origen: string | null = ORIGEN) => {
    const peticion = request(servidor())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', `token_refresco=${refresco}`);
    if (origen !== null) {
      peticion.set('Origin', origen);
    }
    return peticion as Promise<Respuesta>;
  };

  const sesionDe = (token: string) => {
    const [, cuerpo = ''] = token.split('.');
    const { sid } = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) as { sid: string };
    return prisma.sesion.findUniqueOrThrow({ where: { id: sid } });
  };

  const esperar401 = (respuesta: Respuesta) => {
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ success: false, data: null, message: SESION_TERMINO });
  };

  /** 401 en las dos: la común depende solo del guard; la de la sesión, también del caso de uso. */
  const rechazada = async (token: string | null) => {
    esperar401(await rutaComun(token));
    esperar401(await verSesion(token));
  };

  describe('GET /auth/sesion', () => {
    it('el administrador ve su sesión: usuario, empresa, sus empresas, zona y vencimiento', async () => {
      const { acceso } = await entrar();

      const respuesta = await verSesion(acceso);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        success: true,
        message: 'Sesión',
        data: {
          usuario: {
            id: sur.anaId,
            nombreUsuario: 'ana',
            nombreCompleto: 'Ana Pérez',
            debeCambiarContrasena: false,
          },
          empresaActiva: { id: sur.empresaId, nombre: 'Comercial del Sur' },
          empresas: [{ id: sur.empresaId, nombre: 'Comercial del Sur' }],
          esAdministrador: true,
          permisos: [],
          zonaNegocio: 'America/Guayaquil',
          sesionVenceEn: '2026-07-16T02:00:00.000Z',
        },
      });
    });

    it('quien no es administrador en la empresa activa lo ve; sus dos empresas, por nombre', async () => {
      const { acceso } = await entrar('beto');

      const respuesta = await verSesion(acceso);

      expect(respuesta.body.data).toMatchObject({
        empresaActiva: { nombre: 'Comercial del Sur' },
        empresas: [
          { id: sur.empresaId, nombre: 'Comercial del Sur' },
          { id: zeta.empresaId, nombre: 'Zeta Servicios' },
        ],
        esAdministrador: false,
      });
    });

    it('no escribe nada: ni el último uso de la sesión ni la bitácora (AUTH-D8)', async () => {
      const { acceso } = await entrar();
      const antes = await sesionDe(acceso);
      await vaciarAuditoria(prisma);
      reloj.avanzarMinutos(5);

      await verSesion(acceso);

      expect((await sesionDe(acceso)).ultimoUsoEn).toEqual(antes.ultimoUsoEn);
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });
  });

  describe('el guard', () => {
    it('deja el actor de la petición para @UsuarioActual()', async () => {
      const { acceso } = await entrar();

      const respuesta = await rutaComun(acceso);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data).toEqual({
        usuarioId: sur.anaId,
        nombreUsuario: 'ana',
        empresaId: sur.empresaId,
        ip: expect.any(String) as string,
        navegador: 'Navegador e2e',
        requestId: respuesta.headers['x-request-id'],
      });
    });

    it('las rutas públicas siguen sin pedir nada', async () => {
      const respuesta = await conToken('/api/v1/health', null);
      expect(respuesta.status).toBe(200);
    });

    describe('responde 401 «Su sesión terminó»', () => {
      it.each([
        ['sin token', null],
        ['con un token que no es un JWT', 'cualquier-cosa'],
      ])('%s', async (_caso, token) => {
        await rechazada(token);
      });

      it('con la firma cambiada', async () => {
        const { acceso } = await entrar();
        const cambiado = `${acceso.slice(0, -2)}${acceso.endsWith('AA') ? 'BB' : 'AA'}`;
        await rechazada(cambiado);
      });

      it('con un token firmado para otro usuario sobre esta sesión', async () => {
        const { acceso } = await entrar();
        const sesion = await sesionDe(acceso);
        const ajeno = await tokens.firmarAcceso({ usuarioId: zeta.betoId, sesionId: sesion.id });
        await rechazada(ajeno.token);
      });

      it('con el access token vencido (15 minutos)', async () => {
        const { acceso } = await entrar();
        reloj.avanzarMinutos(15);
        await rechazada(acceso);
      });

      it('con la sesión sin uso por 120 minutos, aunque el token sea nuevo', async () => {
        const { acceso } = await entrar();
        const sesion = await sesionDe(acceso);
        reloj.avanzarMinutos(120);
        const nuevo = await tokens.firmarAcceso({ usuarioId: sur.anaId, sesionId: sesion.id });
        await rechazada(nuevo.token);
      });

      it('con la sesión cerrada (otro equipo, el administrador, un reuso)', async () => {
        const { acceso } = await entrar();
        const sesion = await sesionDe(acceso);
        await prisma.sesion.update({
          where: { id: sesion.id },
          data: { cerradaEn: reloj.ahora(), motivoCierre: 'ADMINISTRADOR' },
        });
        await rechazada(acceso);
      });

      it('con el usuario desactivado', async () => {
        const { acceso } = await entrar();
        await prisma.usuario.update({ where: { id: sur.anaId }, data: { activo: false } });
        await rechazada(acceso);
      });

      it('con la empresa activa desactivada', async () => {
        const { acceso } = await entrar();
        await prisma.empresa.update({ where: { id: sur.empresaId }, data: { activo: false } });
        await rechazada(acceso);
      });

      it('si su único rol en la empresa activa se desactiva (sus otras empresas no cuentan)', async () => {
        const { acceso } = await entrar('beto');
        await prisma.rol.updateMany({
          where: { empresaId: sur.empresaId, nombre: 'Operador' },
          data: { activo: false },
        });
        await rechazada(acceso);
      });

      it('si le quitan el rol en la empresa activa', async () => {
        const { acceso } = await entrar('beto');
        await prisma.usuarioRol.deleteMany({
          where: { usuarioId: zeta.betoId, empresaId: sur.empresaId },
        });
        await rechazada(acceso);
      });
    });

    describe('con contraseña temporal (AUTH-D14)', () => {
      let acceso: string;
      let refresco: string;

      beforeEach(async () => {
        await prisma.usuario.update({
          where: { id: sur.anaId },
          data: { debeCambiarContrasena: true },
        });
        ({ acceso, refresco } = await entrar());
      });

      it('una ruta común responde 403', async () => {
        const respuesta = await rutaComun(acceso);
        expect(respuesta.status).toBe(403);
        expect(respuesta.body).toEqual({ success: false, data: null, message: DEBE_CAMBIAR });
      });

      it('GET /auth/sesion, refresh y logout funcionan', async () => {
        const sesion = await verSesion(acceso);
        expect(sesion.status).toBe(200);
        expect(sesion.body.data).toMatchObject({ usuario: { debeCambiarContrasena: true } });

        const renovada = (await request(servidor())
          .post('/api/v1/auth/refresh')
          .set('Origin', ORIGEN)
          .set('Cookie', `token_refresco=${refresco}`)) as Respuesta;
        expect(renovada.status).toBe(200);

        expect((await salir(acceso, refresco)).status).toBe(200);
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('cierra esta sesión (SALIDA), borra la cookie y lo registra; las otras siguen', async () => {
      const otra = await entrar();
      const { acceso, refresco } = await entrar();
      await vaciarAuditoria(prisma);

      const respuesta = await salir(acceso, refresco);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ success: true, data: null, message: 'Sesión cerrada' });
      const cookie = ([respuesta.headers['set-cookie']].flat() as string[]).find((c) =>
        c.startsWith('token_refresco='),
      );
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
      expect(cookie).toContain('Path=/api/v1/auth');
      expect(await sesionDe(acceso)).toMatchObject({
        cerradaEn: reloj.ahora(),
        motivoCierre: 'SALIDA',
      });
      expect((await sesionDe(otra.acceso)).cerradaEn).toBeNull();

      const [evento, ...resto] = await prisma.eventoAuditoria.findMany();
      expect(resto).toEqual([]);
      expect(evento).toMatchObject({
        accion: 'auth.sesion.cerrar',
        entidad: 'sesion',
        entidadId: (await sesionDe(acceso)).id,
        usuarioId: sur.anaId,
        nombreUsuario: 'ana',
        empresaId: sur.empresaId,
      });

      // Después de salir, ni el access token ni la cookie sirven; la otra sesión, sí.
      esperar401(await verSesion(acceso));
      const renovada = (await request(servidor())
        .post('/api/v1/auth/refresh')
        .set('Origin', ORIGEN)
        .set('Cookie', `token_refresco=${refresco}`)) as Respuesta;
      esperar401(renovada);
      expect((await verSesion(otra.acceso)).status).toBe(200);
    });

    it('sin Origin (o de otro sitio) responde 403 y no cierra nada', async () => {
      const { acceso, refresco } = await entrar();

      for (const origen of [null, 'https://otro-sitio.example']) {
        const respuesta = await salir(acceso, refresco, origen);
        expect(respuesta.status).toBe(403);
        expect(respuesta.body.message).toBe('La petición no viene de un sitio permitido');
      }
      expect((await sesionDe(acceso)).cerradaEn).toBeNull();
    });

    it('sin sesión responde 401', async () => {
      const respuesta = (await request(servidor())
        .post('/api/v1/auth/logout')
        .set('Origin', ORIGEN)) as Respuesta;
      esperar401(respuesta);
    });
  });

  describe('la API no arranca si una ruta no tiene exactamente una regla (AUTH-D9)', () => {
    it.each([
      [SinReglaController, 'SinReglaController.olvidada (0 reglas)'],
      [DosReglasController, 'DosReglasController.confusa (2 reglas)'],
    ])('%o', async (controller, detalle) => {
      await expect(crearApp({ controllers: [controller] })).rejects.toThrow(detalle);
    });
  });
});
