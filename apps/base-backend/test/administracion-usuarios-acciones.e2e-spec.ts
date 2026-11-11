import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
  type CrearEmpresaConAdministradorPort,
} from '../src/modules/auth/application/ports/in/crear-empresa-con-administrador.port.js';
import {
  SINCRONIZAR_PERMISOS_PORT,
  type SincronizarPermisosPort,
} from '../src/modules/auth/application/ports/in/sincronizar-permisos.port.js';
import { actorDelSistema } from '../src/shared/application/actor.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd, vaciarAuditoria } from './utilidades/limpiar-bd.js';

const CONTRASENA = 'Margarita-Lunes-47';
const SIN_PERMISO = 'No tiene permiso para esta acción';
const NO_EXISTE = 'El usuario no existe';
const ADMINISTRADOR_DE_OTRO = 'Solo un administrador puede hacer este cambio a otro administrador';
const MAS_PERMISOS = 'No puede hacer este cambio a alguien que tiene permisos que usted no tiene';
const OTRA_EMPRESA =
  'Este usuario también trabaja en otra empresa: solo puede hacer este cambio quien lo administre en todas';
const CREDENCIALES =
  'Credenciales inválidas. Si falló varias veces, espere 15 minutos o pida ayuda al administrador.';

interface Respuesta {
  status: number;
  headers: Record<string, string>;
  body: { success: boolean; data: unknown; message: string };
}

interface UsuarioJson {
  id: string;
  activo: boolean;
  bloqueadoHasta: string | null;
  debeCambiarContrasena: boolean;
  sesiones: unknown[];
}

/**
 * 6.7e: contraseña temporal, desbloquear, cerrar sesiones, desactivar y reactivar, con AUTH-D11
 * (4), AUTH-D12 y la escalada sobre la persona, con la base real.
 */
describe('Administración: acciones sobre usuarios (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sur: string;
  let zeta: string;
  let anaId: string;
  let betoId: string;
  let carlaId: string;
  /** El rol de Carla en Sur: el que le da los permisos de cada prueba. */
  let rolCarla: string;
  let administradorSur: string;
  /** Darío: de Sur, con un rol que da `auth.rol.ver` (un permiso que Carla no tiene). */
  let darioId: string;
  let rolDario: string;
  let tokenAna: string;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
    await app.get<SincronizarPermisosPort>(SINCRONIZAR_PERMISOS_PORT).execute();
    sur = await crearEmpresa('Comercial del Sur', 'ana');
    zeta = await crearEmpresa('Zeta Servicios', 'beto');
    const ana = await prisma.usuario.findUniqueOrThrow({ where: { nombreUsuario: 'ana' } });
    anaId = ana.id;
    betoId = (await prisma.usuario.findUniqueOrThrow({ where: { nombreUsuario: 'beto' } })).id;
    const carla = await prisma.usuario.create({
      data: {
        nombreUsuario: 'carla',
        nombreCompleto: 'Carla Vera',
        hashContrasena: ana.hashContrasena,
        ultimaEmpresaId: sur,
      },
    });
    carlaId = carla.id;
    rolCarla = await darRol(carlaId, sur, 'Jefatura');
    administradorSur = (
      await prisma.rol.findFirstOrThrow({ where: { empresaId: sur, esAdministrador: true } })
    ).id;
    darioId = (
      await prisma.usuario.create({
        data: {
          nombreUsuario: 'dario',
          nombreCompleto: 'Darío',
          hashContrasena: ana.hashContrasena,
          ultimaEmpresaId: sur,
        },
      })
    ).id;
    rolDario = await darRol(darioId, sur, 'Ventas');
    await permisosDelRol(rolDario, 'auth.rol.ver');
    await prisma.usuario.updateMany({ data: { debeCambiarContrasena: false } });
    tokenAna = await entrar('ana');
    await vaciarAuditoria(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const servidor = () => app.getHttpServer() as Parameters<typeof request>[0];

  async function crearEmpresa(nombreEmpresa: string, nombreUsuario: string): Promise<string> {
    const creada = await app
      .get<CrearEmpresaConAdministradorPort>(CREAR_EMPRESA_CON_ADMINISTRADOR_PORT)
      .crear(
        {
          nombreEmpresa,
          administrador: {
            tipo: 'nuevo',
            nombreUsuario,
            nombreCompleto: nombreUsuario,
            contrasena: CONTRASENA,
          },
        },
        actorDelSistema({ nombreUsuario: 'admin:crear-empresa' }),
      );
    return creada.empresa.id;
  }

  async function login(nombreUsuario: string, contrasena = CONTRASENA): Promise<Respuesta> {
    return (await request(servidor())
      .post('/api/v1/auth/login')
      .set('User-Agent', 'Navegador de prueba')
      .send({ nombreUsuario, contrasena })) as Respuesta;
  }

  async function entrar(nombreUsuario: string, contrasena = CONTRASENA): Promise<string> {
    const respuesta = await login(nombreUsuario, contrasena);
    expect(respuesta.status).toBe(200);
    return (respuesta.body.data as { tokenAcceso: string }).tokenAcceso;
  }

  /** Le da al rol exactamente esos permisos (directo en la base). */
  async function permisosDelRol(rolId: string, ...codigos: string[]): Promise<void> {
    await prisma.rolPermiso.deleteMany({ where: { rolId } });
    const permisos = await prisma.permiso.findMany({ where: { codigo: { in: codigos } } });
    await prisma.rolPermiso.createMany({
      data: permisos.map((p) => ({ rolId, permisoId: p.id })),
    });
  }

  /** Un rol nuevo en la empresa, asignado al usuario. */
  async function darRol(
    usuarioId: string,
    empresaId: string,
    nombre: string,
    activo = true,
  ): Promise<string> {
    const rol = await prisma.rol.create({ data: { empresaId, nombre, activo } });
    await prisma.usuarioRol.create({ data: { usuarioId, empresaId, rolId: rol.id } });
    return rol.id;
  }

  const post = (ruta: string, token: string): Promise<Respuesta> => enviar('post', ruta, token);

  /** Una sesión abierta en esa empresa, hecha directo en la base. */
  const sesionEn = (usuarioId: string, empresaId: string) =>
    prisma.sesion.create({
      data: {
        usuarioId,
        empresaId,
        hashRefresh: 'a'.repeat(64),
        iniciadaEn: new Date(),
        venceEn: new Date(Date.now() + 3_600_000),
        ultimoUsoEn: new Date(),
      },
    });

  const usuario = (id: string) => prisma.usuario.findUniqueOrThrow({ where: { id } });

  const rolesDeDario = async () =>
    (await prisma.usuarioRol.findMany({ where: { usuarioId: darioId } })).map((f) => f.rolId);

  const enviar = (
    metodo: 'get' | 'post' | 'put',
    ruta: string,
    token: string | null,
    cuerpo?: unknown,
  ): Promise<Respuesta> => {
    let peticion = request(servidor())[metodo](`/api/v1${ruta}`);
    if (token !== null) {
      peticion = peticion.set('Authorization', `Bearer ${token}`);
    }
    if (cuerpo !== undefined) {
      peticion = peticion.set('Content-Type', 'application/json').send(JSON.stringify(cuerpo));
    }
    return peticion as Promise<Respuesta>;
  };

  const eventos = (accion: string) => prisma.eventoAuditoria.findMany({ where: { accion } });

  /** Espera ese estado y ese mensaje. */
  async function espera(
    respuesta: Promise<Respuesta>,
    estado: number,
    mensaje?: string,
  ): Promise<void> {
    const r = await respuesta;
    expect({ estado: r.status, mensaje: r.body.message }).toEqual({
      estado,
      mensaje: mensaje ?? r.body.message,
    });
  }

  describe('POST /usuarios/:id/contrasena-temporal', () => {
    it('da una temporal (sin caché), desbloquea, cierra todo y deja entrar solo a cambiarla', async () => {
      const tokenDario = await entrar('dario');
      await darRol(darioId, zeta, 'Caja de Zeta');
      await prisma.usuarioRol.create({
        data: {
          usuarioId: anaId,
          empresaId: zeta,
          rolId: (
            await prisma.rol.findFirstOrThrow({ where: { empresaId: zeta, esAdministrador: true } })
          ).id,
        },
      });
      await sesionEn(darioId, zeta);
      await prisma.usuario.update({
        where: { id: darioId },
        data: { intentosFallidos: 2, bloqueadoHasta: new Date(Date.now() + 600_000) },
      });

      const respuesta = await post(`/usuarios/${darioId}/contrasena-temporal`, tokenAna);
      expect(respuesta.status).toBe(200);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(respuesta.body.message).toBe('Contraseña temporal generada');
      const { usuario: ficha, contrasenaTemporal } = respuesta.body.data as {
        usuario: UsuarioJson;
        contrasenaTemporal: string;
      };
      expect(contrasenaTemporal).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/u);
      expect(ficha).toMatchObject({
        id: darioId,
        debeCambiarContrasena: true,
        bloqueadoHasta: null,
      });

      const guardado = await usuario(darioId);
      expect(guardado).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
      expect(guardado.hashContrasena).toMatch(/^\$argon2id\$/u);
      const sesiones = await prisma.sesion.findMany({ where: { usuarioId: darioId } });
      expect(sesiones.map((s) => s.motivoCierre)).toEqual(['ADMINISTRADOR', 'ADMINISTRADOR']);
      expect((await enviar('get', '/auth/sesion', tokenDario)).status).toBe(401);

      const [evento] = await eventos('auth.usuario.contrasena_temporal');
      expect(evento).toMatchObject({
        empresaId: sur,
        entidadId: darioId,
        despues: { claveTemporal: true, sesionesCerradas: 2 },
      });
      expect(JSON.stringify(evento)).not.toContain(contrasenaTemporal);

      // Con la anterior ya no entra; con la temporal, solo a cambiarla (AUTH-D14).
      await espera(login('dario'), 401, CREDENCIALES);
      const tokenTemporal = await entrar('dario', contrasenaTemporal);
      await espera(
        enviar('get', '/usuarios', tokenTemporal),
        403,
        'Debe cambiar su contraseña antes de continuar',
      );
    });

    it('a sí misma 403; de otra empresa 404; id mal 400; desactivado 422', async () => {
      await espera(
        post(`/usuarios/${anaId}/contrasena-temporal`, tokenAna),
        403,
        'Para cambiar su propia contraseña use «Cambiar contraseña»',
      );
      await espera(post(`/usuarios/${betoId}/contrasena-temporal`, tokenAna), 404, NO_EXISTE);
      await espera(post('/usuarios/abc/contrasena-temporal', tokenAna), 400, 'El id no es válido');
      await prisma.usuario.update({ where: { id: darioId }, data: { activo: false } });
      await espera(
        post(`/usuarios/${darioId}/contrasena-temporal`, tokenAna),
        422,
        'El usuario «dario» está desactivado',
      );
      expect(await eventos('auth.usuario.contrasena_temporal')).toEqual([]);
    });

    it('sin ser administradora: sin el permiso 403, a quien tiene más permisos o al administrador no', async () => {
      const tokenCarla = await entrar('carla');
      const ruta = `/usuarios/${darioId}/contrasena-temporal`;
      await espera(post(ruta, tokenCarla), 403, SIN_PERMISO);
      await permisosDelRol(rolCarla, 'auth.usuario.restablecer');
      await espera(post(ruta, tokenCarla), 403, MAS_PERMISOS);
      await espera(
        post(`/usuarios/${anaId}/contrasena-temporal`, tokenCarla),
        403,
        ADMINISTRADOR_DE_OTRO,
      );
      await permisosDelRol(rolCarla, 'auth.usuario.restablecer', 'auth.rol.ver');
      await espera(post(ruta, tokenCarla), 200);
    });

    it('AUTH-D12: si también trabaja en Zeta, hace falta el permiso allí', async () => {
      await darRol(darioId, zeta, 'Caja de Zeta');
      await espera(post(`/usuarios/${darioId}/contrasena-temporal`, tokenAna), 403, OTRA_EMPRESA);
      expect((await usuario(darioId)).debeCambiarContrasena).toBe(false);
    });
  });

  describe('POST /usuarios/:id/desbloquear', () => {
    it('quita el bloqueo (vuelve a entrar) y lo registra; si no estaba, no registra', async () => {
      await prisma.usuario.update({
        where: { id: darioId },
        data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + 600_000) },
      });
      await espera(login('dario'), 401, CREDENCIALES);
      const respuesta = await post(`/usuarios/${darioId}/desbloquear`, tokenAna);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Usuario desbloqueado');
      expect((respuesta.body.data as UsuarioJson).bloqueadoHasta).toBeNull();
      await entrar('dario');
      await espera(post(`/usuarios/${darioId}/desbloquear`, tokenAna), 200);
      expect(await eventos('auth.usuario.desbloquear')).toHaveLength(1);
    });

    it('basta el permiso en Sur aunque también trabaje en Zeta; sin el permiso, 403', async () => {
      const tokenCarla = await entrar('carla');
      await darRol(darioId, zeta, 'Caja de Zeta');
      await prisma.usuario.update({ where: { id: darioId }, data: { intentosFallidos: 3 } });
      await espera(post(`/usuarios/${darioId}/desbloquear`, tokenCarla), 403, SIN_PERMISO);
      await permisosDelRol(rolCarla, 'auth.usuario.restablecer');
      await espera(post(`/usuarios/${darioId}/desbloquear`, tokenCarla), 200);
      expect((await usuario(darioId)).intentosFallidos).toBe(0);
      await espera(post(`/usuarios/${betoId}/desbloquear`, tokenCarla), 404, NO_EXISTE);
    });
  });

  describe('POST /usuarios/:id/cerrar-sesiones', () => {
    it('cierra todas, también las de Zeta, y lo registra', async () => {
      const tokenDario = await entrar('dario');
      await darRol(darioId, zeta, 'Caja de Zeta');
      const enZeta = await sesionEn(darioId, zeta);
      const respuesta = await post(`/usuarios/${darioId}/cerrar-sesiones`, tokenAna);
      expect(respuesta.body).toEqual({
        success: true,
        data: { id: darioId, sesionesCerradas: 2 },
        message: 'Sesiones cerradas',
      });
      expect((await enviar('get', '/auth/sesion', tokenDario)).status).toBe(401);
      const cerrada = await prisma.sesion.findUniqueOrThrow({ where: { id: enZeta.id } });
      expect(cerrada.motivoCierre).toBe('ADMINISTRADOR');
      const [evento] = await eventos('auth.usuario.cerrar_sesiones');
      expect(evento).toMatchObject({ entidadId: darioId, despues: { sesionesCerradas: 2 } });
      // Sin sesiones abiertas: 0 y no registra.
      await post(`/usuarios/${darioId}/cerrar-sesiones`, tokenAna);
      expect(await eventos('auth.usuario.cerrar_sesiones')).toHaveLength(1);
    });

    it('sobre sí misma, la sesión desde la que lo pide sigue', async () => {
      const otroToken = await entrar('ana');
      const respuesta = await post(`/usuarios/${anaId}/cerrar-sesiones`, tokenAna);
      expect(respuesta.body.data).toEqual({ id: anaId, sesionesCerradas: 1 });
      expect((await enviar('get', '/auth/sesion', tokenAna)).status).toBe(200);
      expect((await enviar('get', '/auth/sesion', otroToken)).status).toBe(401);
    });
  });

  describe('POST /usuarios/:id/desactivar y /reactivar', () => {
    it('desactiva (no entra, sesiones cerradas) y reactiva (vuelve a entrar), con su bitácora', async () => {
      const tokenDario = await entrar('dario');
      const respuesta = await post(`/usuarios/${darioId}/desactivar`, tokenAna);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Usuario desactivado');
      expect(respuesta.body.data).toMatchObject({ id: darioId, activo: false, sesiones: [] });
      expect((await enviar('get', '/auth/sesion', tokenDario)).status).toBe(401);
      await espera(login('dario'), 401, CREDENCIALES);
      const [sesion] = await prisma.sesion.findMany({ where: { usuarioId: darioId } });
      expect(sesion?.motivoCierre).toBe('USUARIO_DESACTIVADO');
      expect(await rolesDeDario()).toEqual([rolDario]);
      // Otra vez: no cambia ni registra.
      await espera(post(`/usuarios/${darioId}/desactivar`, tokenAna), 200);
      expect(await eventos('auth.usuario.desactivar')).toHaveLength(1);

      const reactivado = await post(`/usuarios/${darioId}/reactivar`, tokenAna);
      expect(reactivado.status).toBe(200);
      expect(reactivado.body.message).toBe('Usuario reactivado');
      expect((reactivado.body.data as UsuarioJson).activo).toBe(true);
      await entrar('dario');
      await espera(post(`/usuarios/${darioId}/reactivar`, tokenAna), 200);
      const [desactivar] = await eventos('auth.usuario.desactivar');
      expect(desactivar).toMatchObject({
        antes: { activo: true },
        despues: { activo: false, sesionesCerradas: 1 },
      });
      expect(await eventos('auth.usuario.reactivar')).toHaveLength(1);
    });

    it('a sí misma 403; de otra empresa 404', async () => {
      await espera(
        post(`/usuarios/${anaId}/desactivar`, tokenAna),
        403,
        'No puede desactivar su propio usuario',
      );
      await espera(post(`/usuarios/${betoId}/desactivar`, tokenAna), 404, NO_EXISTE);
      await espera(post(`/usuarios/${betoId}/reactivar`, tokenAna), 404, NO_EXISTE);
      expect((await usuario(anaId)).activo).toBe(true);
    });

    it('sin ser administradora: desactivar a quien tiene más permisos sí, al administrador no; reactivar pide sus permisos', async () => {
      const tokenCarla = await entrar('carla');
      await espera(post(`/usuarios/${darioId}/desactivar`, tokenCarla), 403, SIN_PERMISO);
      await permisosDelRol(rolCarla, 'auth.usuario.desactivar');
      await espera(post(`/usuarios/${anaId}/desactivar`, tokenCarla), 403, ADMINISTRADOR_DE_OTRO);
      await espera(post(`/usuarios/${darioId}/desactivar`, tokenCarla), 200);
      await espera(post(`/usuarios/${darioId}/reactivar`, tokenCarla), 403, MAS_PERMISOS);
      await permisosDelRol(rolCarla, 'auth.usuario.desactivar', 'auth.rol.ver');
      await espera(post(`/usuarios/${darioId}/reactivar`, tokenCarla), 200);
    });

    it('AUTH-D12: si también trabaja en Zeta, hace falta el permiso allí', async () => {
      await darRol(darioId, zeta, 'Caja de Zeta');
      await espera(post(`/usuarios/${darioId}/desactivar`, tokenAna), 403, OTRA_EMPRESA);
      expect((await usuario(darioId)).activo).toBe(true);
    });

    it('AUTH-D11 (4): cuenta los administradores con el rol Administrador bloqueado', async () => {
      // Con una sola petición no se puede dejar a Sur sin administrador (quien opera es otra
      // activa): la regla cuida dos a la vez. Aquí otra transacción retiene el rol Administrador
      // y la petición tiene que esperarla.
      await prisma.usuarioRol.create({
        data: { usuarioId: carlaId, empresaId: sur, rolId: administradorSur },
      });
      let terminada = false;
      let peticion: Promise<Respuesta> | undefined;
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT 1 FROM seguridad.roles WHERE id = ${administradorSur}::uuid FOR UPDATE`;
        peticion = post(`/usuarios/${carlaId}/desactivar`, tokenAna).then((r) => {
          terminada = true;
          return r;
        });
        await new Promise((listo) => setTimeout(listo, 500));
        expect(terminada).toBe(false);
      });
      expect((await (peticion as Promise<Respuesta>)).status).toBe(200);
      expect((await usuario(carlaId)).activo).toBe(false);
    });

    it('AUTH-D11 (4): dos administradoras que se desactivan una a la otra a la vez dejan una', async () => {
      await prisma.usuarioRol.create({
        data: { usuarioId: carlaId, empresaId: sur, rolId: administradorSur },
      });
      const tokenCarla = await entrar('carla');
      const respuestas = await Promise.all([
        post(`/usuarios/${carlaId}/desactivar`, tokenAna),
        post(`/usuarios/${anaId}/desactivar`, tokenCarla),
      ]);
      // La segunda o espera y ve 422, o ya no tiene sesión (401): nunca pasan las dos.
      expect(respuestas.filter((r) => r.status === 200)).toHaveLength(1);
      const administradores = await prisma.usuarioRol.count({
        where: { rolId: administradorSur, usuario: { activo: true } },
      });
      expect(administradores).toBe(1);
    });
  });
});
