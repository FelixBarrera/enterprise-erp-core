import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
  type CrearEmpresaConAdministradorPort,
} from '../src/modules/auth/application/ports/in/crear-empresa-con-administrador.port.js';
import {
  HASHER_CONTRASENA_PORT,
  type HasherContrasenaPort,
} from '../src/modules/auth/application/ports/out/hasher-contrasena.port.js';
import { type Actor, actorDelSistema } from '../src/shared/application/actor.js';
import { RELOJ_PORT } from '../src/shared/application/ports/reloj.port.js';
import { RelojFijo } from '../src/shared/application/testing/reloj-fijo.js';
import { SoloSesion } from '../src/shared/infrastructure/http/acceso/acceso.decorators.js';
import { UsuarioActual } from '../src/shared/infrastructure/http/acceso/sesion-de-peticion.js';
import { ok } from '../src/shared/infrastructure/http/respuesta-api.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd, vaciarAuditoria } from './utilidades/limpiar-bd.js';

const CONTRASENA = 'Margarita-Lunes-47';
const NUEVA = 'Girasol-Martes-83';
const ORIGEN = 'http://localhost:4200';
const SESION_TERMINO = 'Su sesión terminó. Vuelva a ingresar.';
const DEBE_CAMBIAR = 'Debe cambiar su contraseña antes de continuar';
const SIN_ACCESO = 'No tiene acceso a esa empresa';
const BLOQUEADA = 'Demasiados intentos fallidos. Espere 15 minutos o pida ayuda al administrador.';

/** Una ruta común de un módulo cualquiera: con sesión y sin contraseña temporal. */
@Controller('prueba-acceso')
class PruebaAccesoController {
  @Get()
  @SoloSesion()
  quienSoy(@UsuarioActual() actor: Actor) {
    return ok(actor, 'Actor');
  }
}

interface Respuesta {
  status: number;
  body: { success: boolean; data: unknown; message: string };
  headers: Record<string, string | string[] | undefined>;
}

/** Cambiar de empresa y cambiar la contraseña contra la base real (6.5d). */
describe('Cambios de la sesión (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let hasher: HasherContrasenaPort;
  const reloj = new RelojFijo('2026-07-15T08:00:00-05:00');
  let sur: { empresaId: string; anaId: string };
  let zeta: { empresaId: string; betoId: string };

  beforeAll(async () => {
    app = await crearApp({
      controllers: [PruebaAccesoController],
      sobrescribir: (b) => b.overrideProvider(RELOJ_PORT).useValue(reloj),
    });
    prisma = app.get(PrismaService);
    hasher = app.get(HASHER_CONTRASENA_PORT);
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
    // Los comandos dejan la contraseña como temporal: aquí ya la cambiaron (salvo que se diga).
    await prisma.usuario.updateMany({ data: { debeCambiarContrasena: false } });
    await vaciarAuditoria(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const servidor = () => app.getHttpServer() as Parameters<typeof request>[0];

  async function login(nombreUsuario: string, contrasena = CONTRASENA): Promise<Respuesta> {
    return (await request(servidor())
      .post('/api/v1/auth/login')
      .send({ nombreUsuario, contrasena })) as Respuesta;
  }

  /** Entra y devuelve el access token y el refresh de la cookie. */
  async function entrar(nombreUsuario = 'ana'): Promise<{ acceso: string; refresco: string }> {
    const respuesta = await login(nombreUsuario);
    expect(respuesta.status).toBe(200);
    const cabecera = respuesta.headers['set-cookie'];
    const cookies = Array.isArray(cabecera) ? cabecera : [cabecera ?? ''];
    const cookie = cookies.find((c) => c.startsWith('token_refresco=')) ?? '';
    return {
      acceso: (respuesta.body.data as { tokenAcceso: string }).tokenAcceso,
      refresco: decodeURIComponent(cookie.split(';')[0]?.slice('token_refresco='.length) ?? ''),
    };
  }

  const ver = (ruta: string, token: string): Promise<Respuesta> =>
    request(servidor()).get(ruta).set('Authorization', `Bearer ${token}`);
  const enviar = (ruta: string, token: string | null, cuerpo: unknown): Promise<Respuesta> => {
    const peticion = request(servidor()).post(ruta);
    if (token !== null) {
      peticion.set('Authorization', `Bearer ${token}`);
    }
    return peticion.send(cuerpo as object);
  };
  const cambiarEmpresa = (token: string | null, cuerpo: unknown) =>
    enviar('/api/v1/auth/empresa', token, cuerpo);
  const cambiarContrasena = (token: string | null, cuerpo: unknown) =>
    enviar('/api/v1/auth/cambiar-contrasena', token, cuerpo);
  const renovar = (refresco: string): Promise<Respuesta> =>
    request(servidor())
      .post('/api/v1/auth/refresh')
      .set('Origin', ORIGEN)
      .set('Cookie', `token_refresco=${refresco}`);

  const sesionDe = (token: string) => {
    const [, cuerpo = ''] = token.split('.');
    const { sid } = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) as { sid: string };
    return prisma.sesion.findUniqueOrThrow({ where: { id: sid } });
  };

  describe('POST /auth/empresa', () => {
    it('pasa la sesión a la otra empresa: el mismo token ya trabaja en ella', async () => {
      const { acceso } = await entrar('beto');

      const respuesta = await cambiarEmpresa(acceso, { empresaId: zeta.empresaId });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toMatchObject({
        success: true,
        message: 'Empresa cambiada',
        data: {
          empresaActiva: { id: zeta.empresaId, nombre: 'Zeta Servicios' },
          esAdministrador: true,
          permisos: [],
        },
      });
      // El guard ya ve la empresa nueva en cualquier ruta.
      expect((await ver('/api/v1/prueba-acceso', acceso)).body.data).toMatchObject({
        empresaId: zeta.empresaId,
      });
      expect((await ver('/api/v1/auth/sesion', acceso)).body.data).toMatchObject({
        empresaActiva: { id: zeta.empresaId },
        esAdministrador: true,
      });
      expect((await sesionDe(acceso)).empresaId).toBe(zeta.empresaId);
      const beto = await prisma.usuario.findUniqueOrThrow({ where: { id: zeta.betoId } });
      expect(beto.ultimaEmpresaId).toBe(zeta.empresaId);
    });

    it('lo registra en la empresa nueva, con la anterior', async () => {
      const { acceso } = await entrar('beto');
      await vaciarAuditoria(prisma);

      await cambiarEmpresa(acceso, { empresaId: zeta.empresaId });

      const eventos = await prisma.eventoAuditoria.findMany();
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        accion: 'auth.sesion.cambiar_empresa',
        empresaId: zeta.empresaId,
        usuarioId: zeta.betoId,
        nombreUsuario: 'beto',
        entidad: 'sesion',
      });
      expect(JSON.stringify(eventos[0])).toContain(sur.empresaId);
    });

    it('la próxima vez entra a la última empresa usada (AUTH-D4)', async () => {
      const { acceso } = await entrar('beto');
      await cambiarEmpresa(acceso, { empresaId: zeta.empresaId });

      const otra = await entrar('beto');

      expect((await sesionDe(otra.acceso)).empresaId).toBe(zeta.empresaId);
    });

    it('a la misma empresa: 200 sin cambios ni evento', async () => {
      const { acceso } = await entrar('beto');
      await vaciarAuditoria(prisma);

      const respuesta = await cambiarEmpresa(acceso, { empresaId: sur.empresaId });

      expect(respuesta.status).toBe(200);
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });

    it('a una empresa donde no tiene rol: 403, sigue donde estaba', async () => {
      const { acceso } = await entrar('ana');

      const respuesta = await cambiarEmpresa(acceso, { empresaId: zeta.empresaId });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body).toEqual({ success: false, data: null, message: SIN_ACCESO });
      expect((await sesionDe(acceso)).empresaId).toBe(sur.empresaId);
    });

    it('a una empresa desactivada: 403', async () => {
      const { acceso } = await entrar('beto');
      await prisma.empresa.update({ where: { id: zeta.empresaId }, data: { activo: false } });

      const respuesta = await cambiarEmpresa(acceso, { empresaId: zeta.empresaId });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.message).toBe(SIN_ACCESO);
    });

    it('sin sesión: 401', async () => {
      const respuesta = await cambiarEmpresa(null, { empresaId: zeta.empresaId });
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.message).toBe(SESION_TERMINO);
    });

    it('con contraseña temporal: 403 (AUTH-D14)', async () => {
      await prisma.usuario.update({
        where: { id: zeta.betoId },
        data: { debeCambiarContrasena: true },
      });
      const { acceso } = await entrar('beto');

      const respuesta = await cambiarEmpresa(acceso, { empresaId: zeta.empresaId });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.message).toBe(DEBE_CAMBIAR);
    });

    it.each([
      ['sin cuerpo', {}, 'El id de la empresa es obligatorio y debe ser texto'],
      ['null', { empresaId: null }, 'El id de la empresa es obligatorio y debe ser texto'],
      ['vacío', { empresaId: '' }, 'El id de la empresa no es válido'],
      ['espacios', { empresaId: '   ' }, 'El id de la empresa no es válido'],
      ['número', { empresaId: 7 }, 'El id de la empresa es obligatorio y debe ser texto'],
      ['no es UUID', { empresaId: 'abc' }, 'El id de la empresa no es válido'],
    ])('400 %s, sin cambios', async (_caso, cuerpo, mensaje) => {
      const { acceso } = await entrar('beto');
      await vaciarAuditoria(prisma);

      const respuesta = await cambiarEmpresa(acceso, cuerpo);

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.message).toContain(mensaje);
      expect((await sesionDe(acceso)).empresaId).toBe(sur.empresaId);
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });
  });

  describe('POST /auth/cambiar-contrasena', () => {
    const hashDe = async (id: string) =>
      (await prisma.usuario.findUniqueOrThrow({ where: { id } })).hashContrasena;

    it('cambia la contraseña, cierra las otras sesiones y esta sigue', async () => {
      const esta = await entrar('ana');
      const otra = await entrar('ana');
      await vaciarAuditoria(prisma);

      const respuesta = await cambiarContrasena(esta.acceso, {
        contrasenaActual: CONTRASENA,
        contrasenaNueva: NUEVA,
      });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ success: true, data: null, message: 'Contraseña cambiada' });
      expect(await hasher.verificar(await hashDe(sur.anaId), NUEVA)).toBe(true);
      // Esta sesión sigue: su token y su refresh.
      expect((await ver('/api/v1/auth/sesion', esta.acceso)).status).toBe(200);
      expect((await renovar(esta.refresco)).status).toBe(200);
      // La otra no: ni el token ni el refresh.
      expect((await ver('/api/v1/auth/sesion', otra.acceso)).status).toBe(401);
      expect((await renovar(otra.refresco)).status).toBe(401);
      expect((await sesionDe(otra.acceso)).motivoCierre).toBe('CAMBIO_CONTRASENA');
      // La vieja ya no entra; la nueva sí.
      expect((await login('ana')).status).toBe(401);
      expect((await login('ana', NUEVA)).status).toBe(200);
    });

    it('lo registra sin la contraseña ni el hash', async () => {
      const { acceso } = await entrar('ana');
      await vaciarAuditoria(prisma);

      await cambiarContrasena(acceso, { contrasenaActual: CONTRASENA, contrasenaNueva: NUEVA });

      const eventos = await prisma.eventoAuditoria.findMany();
      expect(eventos.map((e) => e.accion)).toEqual(['auth.usuario.cambiar_contrasena']);
      expect(eventos[0]).toMatchObject({ empresaId: sur.empresaId, entidadId: sur.anaId });
      const texto = JSON.stringify(eventos[0]);
      expect(texto).not.toContain(NUEVA);
      expect(texto).not.toContain(CONTRASENA);
      expect(texto).not.toContain('$argon2');
    });

    it('con contraseña temporal: es lo único que puede hacer, y después ya puede trabajar', async () => {
      await prisma.usuario.update({
        where: { id: sur.anaId },
        data: { debeCambiarContrasena: true },
      });
      const { acceso } = await entrar('ana');
      expect((await ver('/api/v1/prueba-acceso', acceso)).status).toBe(403);

      const respuesta = await cambiarContrasena(acceso, {
        contrasenaActual: CONTRASENA,
        contrasenaNueva: NUEVA,
      });

      expect(respuesta.status).toBe(200);
      expect((await ver('/api/v1/prueba-acceso', acceso)).status).toBe(200);
      expect((await ver('/api/v1/auth/sesion', acceso)).body.data).toMatchObject({
        usuario: { debeCambiarContrasena: false },
      });
    });

    it('actual incorrecta: 400 y cuenta como fallo; al quinto se bloquea y ya no deja probar', async () => {
      const { acceso, refresco } = await entrar('ana');
      const mal = { contrasenaActual: 'no-es-esta-1', contrasenaNueva: NUEVA };

      for (let intento = 1; intento <= 5; intento++) {
        const respuesta = await cambiarContrasena(acceso, mal);
        expect(respuesta.status).toBe(400);
        expect(respuesta.body.message).toBe('La contraseña actual no es correcta');
      }

      const ana = await prisma.usuario.findUniqueOrThrow({ where: { id: sur.anaId } });
      expect(ana.bloqueadoHasta).not.toBeNull();
      // Bloqueada: ni con la correcta, y tampoco puede entrar en otro equipo.
      const conLaCorrecta = await cambiarContrasena(acceso, {
        contrasenaActual: CONTRASENA,
        contrasenaNueva: NUEVA,
      });
      expect(conLaCorrecta.status).toBe(403);
      expect(conLaCorrecta.body.message).toBe(BLOQUEADA);
      expect((await login('ana')).status).toBe(401);
      // La sesión abierta sigue funcionando.
      expect((await ver('/api/v1/auth/sesion', acceso)).status).toBe(200);
      const acciones = (await prisma.eventoAuditoria.findMany({ orderBy: { id: 'asc' } })).map(
        (e) => e.accion,
      );
      expect(acciones.filter((a) => a === 'auth.usuario.cambiar_contrasena_fallido')).toHaveLength(
        5,
      );
      expect(acciones).toContain('auth.usuario.bloquear');

      // Pasado el bloqueo (el access token también venció: la pantalla lo renueva antes).
      reloj.avanzarMinutos(15);
      const renovada = await renovar(refresco);
      const nuevoAcceso = (renovada.body.data as { tokenAcceso: string }).tokenAcceso;
      const pasado = await cambiarContrasena(nuevoAcceso, {
        contrasenaActual: CONTRASENA,
        contrasenaNueva: NUEVA,
      });
      expect(pasado.status).toBe(200);
    });

    it.each([
      ['igual a la actual', CONTRASENA, 'La contraseña nueva debe ser distinta de la actual'],
      ['corta', 'abc', 'La contraseña debe tener al menos 8 caracteres'],
      ['con el usuario', 'ana-flores-2026', 'La contraseña no puede contener su nombre de usuario'],
      [
        'con la empresa',
        'comercial-2026!',
        'La contraseña no puede contener el nombre de la empresa',
      ],
    ])('nueva %s: 400 sin cambios', async (_caso, contrasenaNueva, mensaje) => {
      const { acceso } = await entrar('ana');
      const antes = await hashDe(sur.anaId);
      await vaciarAuditoria(prisma);

      const respuesta = await cambiarContrasena(acceso, {
        contrasenaActual: CONTRASENA,
        contrasenaNueva,
      });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.message).toBe(mensaje);
      expect(await hashDe(sur.anaId)).toBe(antes);
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });

    it.each([
      ['sin cuerpo', {}, 'La contraseña actual es obligatoria y debe ser texto'],
      [
        'actual null',
        { contrasenaActual: null, contrasenaNueva: NUEVA },
        'La contraseña actual es obligatoria y debe ser texto',
      ],
      [
        'actual vacía',
        { contrasenaActual: '', contrasenaNueva: NUEVA },
        'La contraseña actual es obligatoria',
      ],
      [
        'actual número',
        { contrasenaActual: 7, contrasenaNueva: NUEVA },
        'La contraseña actual es obligatoria y debe ser texto',
      ],
      [
        'nueva ausente',
        { contrasenaActual: CONTRASENA },
        'La contraseña nueva es obligatoria y debe ser texto',
      ],
      [
        'nueva null',
        { contrasenaActual: CONTRASENA, contrasenaNueva: null },
        'La contraseña nueva es obligatoria y debe ser texto',
      ],
      [
        'nueva vacía',
        { contrasenaActual: CONTRASENA, contrasenaNueva: '' },
        'La contraseña nueva es obligatoria',
      ],
      [
        'nueva enorme',
        { contrasenaActual: CONTRASENA, contrasenaNueva: 'x'.repeat(1001) },
        'La contraseña nueva es demasiado larga',
      ],
    ])('400 %s: no cuenta como fallo ni toca la base', async (_caso, cuerpo, mensaje) => {
      const { acceso } = await entrar('ana');
      await vaciarAuditoria(prisma);

      const respuesta = await cambiarContrasena(acceso, cuerpo);

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.message).toContain(mensaje);
      const ana = await prisma.usuario.findUniqueOrThrow({ where: { id: sur.anaId } });
      expect(ana.intentosFallidos).toBe(0);
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });

    it('nueva de solo espacios: la rechaza la regla de la contraseña, no la validación', async () => {
      const { acceso } = await entrar('ana');
      const respuesta = await cambiarContrasena(acceso, {
        contrasenaActual: CONTRASENA,
        contrasenaNueva: '        ',
      });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.message).toContain('demasiado fácil de adivinar');
    });

    it('sin sesión: 401', async () => {
      const respuesta = await cambiarContrasena(null, {
        contrasenaActual: CONTRASENA,
        contrasenaNueva: NUEVA,
      });
      expect(respuesta.status).toBe(401);
    });
  });
});
