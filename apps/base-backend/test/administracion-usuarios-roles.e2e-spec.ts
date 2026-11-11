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
const PROPIOS = 'No puede cambiar sus propios roles';
const NO_TIENE = 'No puede dar permisos que usted no tiene';
const SOLO_ADMINISTRADOR = 'Solo un administrador puede dar o quitar el rol Administrador';
const ROL_DESACTIVADO = 'No se puede dar un rol desactivado';
const ROL_NO_EXISTE = 'Alguno de los roles elegidos no existe';

interface Respuesta {
  status: number;
  headers: Record<string, string>;
  body: { success: boolean; data: unknown; message: string };
}

interface UsuarioJson {
  id: string;
  nombreUsuario: string;
  nombreCompleto: string;
  debeCambiarContrasena: boolean;
  trabajaEnOtrasEmpresas: boolean;
  roles: { id: string; nombre: string; esAdministrador: boolean; activo: boolean }[];
}

/**
 * 6.7d: crear usuarios (con contraseña temporal), fijar sus roles y
 * quitarle el acceso, con cada regla de AUTH-D11, con la base real.
 */
describe('Administración: accesos de usuarios (e2e)', () => {
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
  /** Un rol de Sur con `auth.usuario.ver`, sin nadie. */
  let caja: string;
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
    caja = (await prisma.rol.create({ data: { empresaId: sur, nombre: 'Caja' } })).id;
    await permisosDelRol(caja, 'auth.usuario.ver');
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

  const rolesDe = async (usuarioId: string, empresaId: string) =>
    (await prisma.usuarioRol.findMany({ where: { usuarioId, empresaId } }))
      .map((f) => f.rolId)
      .sort();

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

  describe('POST /usuarios', () => {
    it('crea con la temporal (una vez, sin caché), sus roles, y lo registra sin la contraseña', async () => {
      const respuesta = await enviar('post', '/usuarios', tokenAna, {
        nombreUsuario: ' Dario.M ',
        nombreCompleto: ' Darío   Muñoz ',
        roles: [caja],
      });
      expect(respuesta.status).toBe(201);
      expect(respuesta.body.message).toBe('Usuario creado');
      expect(respuesta.headers['cache-control']).toBe('no-store');
      const { usuario, contrasenaTemporal } = respuesta.body.data as {
        usuario: UsuarioJson;
        contrasenaTemporal: string;
      };
      expect(contrasenaTemporal).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{12}$/u);
      expect(usuario).toMatchObject({
        nombreUsuario: 'dario.m',
        nombreCompleto: 'Darío Muñoz',
        debeCambiarContrasena: true,
        trabajaEnOtrasEmpresas: false,
        roles: [{ id: caja, nombre: 'Caja', esAdministrador: false, activo: true }],
      });
      const guardado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
      expect(guardado).toMatchObject({
        debeCambiarContrasena: true,
        activo: true,
        creadoPor: anaId,
        actualizadoPor: anaId,
      });
      expect(guardado.hashContrasena).toMatch(/^\$argon2id\$/u);
      expect(guardado.hashContrasena).not.toContain(contrasenaTemporal);
      expect(await prisma.usuarioRol.findMany({ where: { usuarioId: usuario.id } })).toEqual([
        expect.objectContaining({ empresaId: sur, rolId: caja, creadoPor: anaId }),
      ]);
      const [evento] = await eventos('auth.usuario.crear');
      expect(evento).toMatchObject({
        empresaId: sur,
        usuarioId: anaId,
        entidad: 'usuario',
        entidadId: usuario.id,
        entidadNombre: usuario.nombreUsuario,
        despues: {
          nombreUsuario: 'dario.m',
          nombreCompleto: 'Darío Muñoz',
          claveTemporal: true,
          activo: true,
          roles: ['Caja'],
        },
      });
      expect(JSON.stringify(await prisma.eventoAuditoria.findMany())).not.toContain(
        contrasenaTemporal,
      );

      // Entra con la temporal, y hasta cambiarla solo puede lo de AUTH-D14.
      const tokenDario = await entrar('dario.m', contrasenaTemporal);
      await espera(
        enviar('get', '/usuarios', tokenDario),
        403,
        'Debe cambiar su contraseña antes de continuar',
      );
    });

    it('matriz de null y datos mal: 400 con su mensaje y no crea nada', async () => {
      const bien = { nombreUsuario: 'dario', nombreCompleto: 'Darío', roles: [caja] };
      const casos: [Record<string, unknown>, string | null][] = [
        [
          { ...bien, nombreUsuario: undefined },
          'El nombre de usuario es obligatorio y debe ser texto',
        ],
        [{ ...bien, nombreUsuario: null }, 'El nombre de usuario es obligatorio y debe ser texto'],
        [{ ...bien, nombreUsuario: '' }, 'El nombre de usuario es obligatorio'],
        [{ ...bien, nombreUsuario: '   ' }, 'El nombre de usuario es obligatorio'],
        [{ ...bien, nombreUsuario: 12 }, 'El nombre de usuario es obligatorio y debe ser texto'],
        [
          { ...bien, nombreUsuario: 'darío' },
          'El nombre de usuario debe tener de 3 a 50 caracteres: letras sin tildes ni ñ, números, punto, guion o guion bajo',
        ],
        [
          { ...bien, nombreCompleto: undefined },
          'El nombre completo es obligatorio y debe ser texto',
        ],
        [{ ...bien, nombreCompleto: null }, 'El nombre completo es obligatorio y debe ser texto'],
        [{ ...bien, nombreCompleto: '  ' }, 'El nombre completo es obligatorio'],
        [{ ...bien, roles: undefined }, 'Los roles son obligatorios y deben ser una lista'],
        [{ ...bien, roles: null }, 'Los roles son obligatorios y deben ser una lista'],
        [{ ...bien, roles: caja }, 'Los roles son obligatorios y deben ser una lista'],
        [{ ...bien, roles: [] }, 'Debe elegir al menos un rol'],
        [{ ...bien, roles: ['abc'] }, 'Cada rol debe ser un id válido'],
        [{ ...bien, roles: [12] }, 'Cada rol debe ser un id válido'],
        [{ ...bien, roles: ['0190a4f2-1c2b-7000-8000-000000000999'] }, ROL_NO_EXISTE],
        [{ ...bien, debeCambiarContrasena: false }, null],
        [{ ...bien, contrasena: 'Mia-Propia-2026' }, null],
      ];
      for (const [cuerpo, mensaje] of casos) {
        const respuesta = await enviar('post', '/usuarios', tokenAna, cuerpo);
        expect({ cuerpo, estado: respuesta.status }).toEqual({ cuerpo, estado: 400 });
        if (mensaje !== null) {
          expect(respuesta.body.message).toBe(mensaje);
        }
      }
      expect(await prisma.usuario.count()).toBe(3);
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });

    it('un nombre que ya existe (aunque esté desactivado o en otra empresa): 409', async () => {
      await prisma.usuario.update({ where: { id: betoId }, data: { activo: false } });
      await espera(
        enviar('post', '/usuarios', tokenAna, {
          nombreUsuario: 'BETO',
          nombreCompleto: 'Otro Beto',
          roles: [caja],
        }),
        409,
        'Ese nombre de usuario ya existe (aunque esté desactivado, no se vuelve a usar). Elija otro',
      );
    });

    it('un rol de otra empresa: 400; uno desactivado: 422', async () => {
      const deZeta = (await prisma.rol.create({ data: { empresaId: zeta, nombre: 'Caja' } })).id;
      const apagado = (
        await prisma.rol.create({ data: { empresaId: sur, nombre: 'Viejo', activo: false } })
      ).id;
      const cuerpo = (roles: string[]) => ({ nombreUsuario: 'dario', nombreCompleto: 'D', roles });
      await espera(enviar('post', '/usuarios', tokenAna, cuerpo([deZeta])), 400, ROL_NO_EXISTE);
      await espera(enviar('post', '/usuarios', tokenAna, cuerpo([apagado])), 422, ROL_DESACTIVADO);
      expect(await prisma.usuario.count()).toBe(3);
    });

    it('sin el permiso 403; sin ser administradora, solo roles con permisos que ella tiene', async () => {
      const tokenCarla = await entrar('carla');
      const cuerpo = (nombreUsuario: string, roles: string[]) => ({
        nombreUsuario,
        nombreCompleto: 'X',
        roles,
      });
      await espera(
        enviar('post', '/usuarios', tokenCarla, cuerpo('dario1', [caja])),
        403,
        SIN_PERMISO,
      );
      await permisosDelRol(rolCarla, 'auth.usuario.crear');
      await espera(
        enviar('post', '/usuarios', tokenCarla, cuerpo('dario1', [caja])),
        403,
        NO_TIENE,
      );
      await espera(
        enviar('post', '/usuarios', tokenCarla, cuerpo('dario1', [administradorSur])),
        403,
        SOLO_ADMINISTRADOR,
      );
      await permisosDelRol(rolCarla, 'auth.usuario.crear', 'auth.usuario.ver');
      await espera(enviar('post', '/usuarios', tokenCarla, cuerpo('dario1', [caja])), 201);
    });
  });

  describe('POST /usuarios/existente (quitado en el 6.12b6)', () => {
    it('ya no existe: 404 y no da acceso', async () => {
      const respuesta = await enviar('post', '/usuarios/existente', tokenAna, {
        nombreUsuario: 'beto',
        roles: [caja],
      });
      expect(respuesta.status).toBe(404);
      expect(await rolesDe(betoId, sur)).toEqual([]);
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });

    it('pie de la ficha (6.12a0): un acceso dado antes cuenta como alta; los ingresos y lo de Zeta no', async () => {
      // Como quedó de antes del 6.12b6 (o de admin:crear-empresa): su rol y su evento dar_acceso.
      await prisma.usuarioRol.create({ data: { usuarioId: betoId, empresaId: sur, rolId: caja } });
      await prisma.eventoAuditoria.create({
        data: {
          ocurridoEn: new Date(),
          empresaId: sur,
          usuarioId: anaId,
          nombreUsuario: 'ana',
          accion: 'auth.usuario.dar_acceso',
          entidad: 'usuario',
          entidadId: betoId,
        },
      });
      const tokenBeto = await entrar('beto');
      await espera(
        request(servidor())
          .post('/api/v1/auth/empresa')
          .set('Authorization', `Bearer ${tokenBeto}`)
          .send({ empresaId: sur }) as Promise<Respuesta>,
        200,
      );
      // Un cambio en Zeta (lo hizo alguien de allá): en Sur no se ve.
      await prisma.eventoAuditoria.create({
        data: {
          ocurridoEn: new Date(),
          empresaId: zeta,
          nombreUsuario: 'jefe.zeta',
          accion: 'auth.usuario.editar',
          entidad: 'usuario',
          entidadId: betoId,
        },
      });
      type Pie = { creado: { por: string | null } | null; modificado: { por: string } | null };
      const pie = async () =>
        (await enviar('get', `/usuarios/${betoId}`, tokenAna)).body.data as Pie;
      expect(await pie()).toMatchObject({ creado: { por: 'ana' }, modificado: null });

      await enviar('put', `/usuarios/${betoId}/roles`, tokenAna, { roles: [rolCarla] });
      expect((await pie()).modificado?.por).toBe('ana');
    });
  });

  describe('PUT /usuarios/:id/roles', () => {
    it('deja exactamente esos, guarda quién y registra el antes y el después', async () => {
      const respuesta = await enviar('put', `/usuarios/${carlaId}/roles`, tokenAna, {
        roles: [caja],
      });
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Roles actualizados');
      expect((respuesta.body.data as UsuarioJson).roles.map((r) => r.nombre)).toEqual(['Caja']);
      expect(await prisma.usuarioRol.findMany({ where: { usuarioId: carlaId } })).toEqual([
        expect.objectContaining({ rolId: caja, creadoPor: anaId }),
      ]);
      const [evento] = await eventos('auth.usuario.asignar_roles');
      expect(evento).toMatchObject({
        empresaId: sur,
        entidadId: carlaId,
        entidadNombre: 'carla',
        antes: { roles: ['Jefatura'] },
        despues: { roles: ['Caja'] },
      });
    });

    it('los mismos: 200 sin registrar; lista vacía y matriz de null: 400', async () => {
      await espera(
        enviar('put', `/usuarios/${carlaId}/roles`, tokenAna, { roles: [rolCarla] }),
        200,
      );
      const casos: [unknown, string | null][] = [
        [{ roles: [] }, 'Para quitarle todos los roles use Quitar acceso'],
        [{}, 'Los roles son obligatorios y deben ser una lista'],
        [{ roles: null }, 'Los roles son obligatorios y deben ser una lista'],
        [{ roles: 'x' }, 'Los roles son obligatorios y deben ser una lista'],
        [{ roles: [''] }, 'Cada rol debe ser un id válido'],
        [{ roles: [caja], otro: 1 }, null],
      ];
      for (const [cuerpo, mensaje] of casos) {
        const respuesta = await enviar('put', `/usuarios/${carlaId}/roles`, tokenAna, cuerpo);
        expect(respuesta.status).toBe(400);
        if (mensaje !== null) {
          expect(respuesta.body.message).toBe(mensaje);
        }
      }
      expect(await rolesDe(carlaId, sur)).toEqual([rolCarla]);
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });

    it('un desactivado que ya tenía puede quedar; uno nuevo desactivado, 422', async () => {
      const viejo = await darRol(carlaId, sur, 'Viejo', false);
      await espera(
        enviar('put', `/usuarios/${carlaId}/roles`, tokenAna, { roles: [viejo, caja] }),
        200,
      );
      const otro = (
        await prisma.rol.create({ data: { empresaId: sur, nombre: 'Otro', activo: false } })
      ).id;
      await espera(
        enviar('put', `/usuarios/${carlaId}/roles`, tokenAna, { roles: [otro] }),
        422,
        ROL_DESACTIVADO,
      );
      expect(await rolesDe(carlaId, sur)).toEqual([caja, viejo].sort());
    });

    it('aislamiento: uno de otra empresa 404 (y no se toca); un rol de otra empresa 400', async () => {
      await espera(
        enviar('put', `/usuarios/${betoId}/roles`, tokenAna, { roles: [caja] }),
        404,
        NO_EXISTE,
      );
      expect(await rolesDe(betoId, sur)).toEqual([]);
      const deZeta = (await prisma.rol.create({ data: { empresaId: zeta, nombre: 'X' } })).id;
      await espera(
        enviar('put', `/usuarios/${carlaId}/roles`, tokenAna, { roles: [deZeta] }),
        400,
        ROL_NO_EXISTE,
      );
    });

    it('AUTH-D11 (1): nadie cambia los suyos, ni la administradora', async () => {
      await espera(
        enviar('put', `/usuarios/${anaId}/roles`, tokenAna, { roles: [administradorSur] }),
        403,
        PROPIOS,
      );
    });

    it('AUTH-D11 (2) y (3) sin ser administradora; quitar un rol que no podría dar, sí', async () => {
      const tokenCarla = await entrar('carla');
      const dario = await prisma.usuario.create({
        data: { nombreUsuario: 'dario', nombreCompleto: 'Darío', hashContrasena: 'h' },
      });
      const ventas = await darRol(dario.id, sur, 'Ventas');
      await permisosDelRol(ventas, 'auth.rol.editar');
      await espera(
        enviar('put', `/usuarios/${dario.id}/roles`, tokenCarla, { roles: [caja] }),
        403,
        SIN_PERMISO,
      );
      await permisosDelRol(rolCarla, 'auth.usuario.asignar_roles');
      await espera(
        enviar('put', `/usuarios/${dario.id}/roles`, tokenCarla, { roles: [ventas, caja] }),
        403,
        NO_TIENE,
      );
      await permisosDelRol(rolCarla, 'auth.usuario.asignar_roles', 'auth.usuario.ver');
      await espera(
        enviar('put', `/usuarios/${dario.id}/roles`, tokenCarla, { roles: [caja] }),
        200,
      );
      await espera(
        enviar('put', `/usuarios/${dario.id}/roles`, tokenCarla, {
          roles: [caja, administradorSur],
        }),
        403,
        SOLO_ADMINISTRADOR,
      );
      await espera(
        enviar('put', `/usuarios/${anaId}/roles`, tokenCarla, { roles: [caja] }),
        403,
        SOLO_ADMINISTRADOR,
      );
      await espera(
        enviar('put', `/usuarios/${carlaId}/roles`, tokenCarla, { roles: [caja] }),
        403,
        PROPIOS,
      );
    });

    it('AUTH-D11 (4): cuenta los administradores con el rol Administrador bloqueado', async () => {
      // Con una sola petición no se puede dejar a Sur sin administrador (quien opera es uno
      // activo y no se cambia a sí mismo): la regla cuida dos cambios a la vez. Aquí, otra
      // transacción retiene el rol Administrador y la petición tiene que esperarla.
      await prisma.usuarioRol.create({
        data: { usuarioId: carlaId, empresaId: sur, rolId: administradorSur },
      });
      let terminada = false;
      let peticion: Promise<Respuesta> | undefined;
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT 1 FROM seguridad.roles WHERE id = ${administradorSur}::uuid FOR UPDATE`;
        peticion = enviar('put', `/usuarios/${carlaId}/roles`, tokenAna, {
          roles: [rolCarla],
        }).then((r) => {
          terminada = true;
          return r;
        });
        await new Promise((listo) => setTimeout(listo, 500));
        expect(terminada).toBe(false);
      });
      const respuesta = await (peticion as Promise<Respuesta>);
      expect(respuesta.status).toBe(200);
      expect(await rolesDe(carlaId, sur)).toEqual([rolCarla]);
    });

    it('AUTH-D11 (4): dos administradores que se quitan el rol a la vez dejan uno', async () => {
      await prisma.usuarioRol.create({
        data: { usuarioId: carlaId, empresaId: sur, rolId: administradorSur },
      });
      const tokenCarla = await entrar('carla');
      const respuestas = await Promise.all([
        enviar('put', `/usuarios/${carlaId}/roles`, tokenAna, { roles: [rolCarla] }),
        enviar('put', `/usuarios/${anaId}/roles`, tokenCarla, { roles: [caja] }),
      ]);
      expect(respuestas.filter((r) => r.status === 200)).toHaveLength(1);
      const administradores = await prisma.usuarioRol.count({
        where: { rolId: administradorSur, usuario: { activo: true } },
      });
      expect(administradores).toBe(1);
    });
  });

  describe('POST /usuarios/:id/quitar-acceso', () => {
    it('le quita sus roles y sus sesiones aquí (no las de Zeta), y lo registra', async () => {
      const tokenCarla = await entrar('carla');
      await darRol(carlaId, zeta, 'Caja de Zeta');
      const enZeta = await prisma.sesion.create({
        data: {
          usuarioId: carlaId,
          empresaId: zeta,
          hashRefresh: 'a'.repeat(64),
          iniciadaEn: new Date(),
          venceEn: new Date(Date.now() + 3_600_000),
          ultimoUsoEn: new Date(),
        },
      });
      const respuesta = await enviar('post', `/usuarios/${carlaId}/quitar-acceso`, tokenAna);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        success: true,
        data: { id: carlaId, sesionesCerradas: 1 },
        message: 'Acceso quitado',
      });
      expect(await rolesDe(carlaId, sur)).toEqual([]);
      expect(await rolesDe(carlaId, zeta)).toHaveLength(1);
      // Su sesión en Sur dejó de valer al instante; la de Zeta sigue abierta.
      expect((await enviar('get', '/auth/sesion', tokenCarla)).status).toBe(401);
      const sesiones = await prisma.sesion.findMany({ where: { usuarioId: carlaId } });
      expect(sesiones.find((s) => s.empresaId === sur)?.motivoCierre).toBe('ACCESO_QUITADO');
      expect(sesiones.find((s) => s.id === enZeta.id)?.cerradaEn).toBeNull();
      const [evento] = await eventos('auth.usuario.quitar_acceso');
      expect(evento).toMatchObject({
        empresaId: sur,
        entidadId: carlaId,
        entidadNombre: 'carla',
        antes: { roles: ['Jefatura'] },
        despues: { roles: [], sesionesCerradas: 1 },
      });
      // Ya no es de Sur: su ficha da 404.
      await espera(enviar('get', `/usuarios/${carlaId}`, tokenAna), 404, NO_EXISTE);
    });

    it('a sí misma 403; uno de otra empresa 404; un id mal escrito 400', async () => {
      await espera(enviar('post', `/usuarios/${anaId}/quitar-acceso`, tokenAna), 403, PROPIOS);
      await espera(enviar('post', `/usuarios/${betoId}/quitar-acceso`, tokenAna), 404, NO_EXISTE);
      await espera(
        enviar('post', '/usuarios/abc/quitar-acceso', tokenAna),
        400,
        'El id no es válido',
      );
      expect(await rolesDe(betoId, zeta)).toHaveLength(1);
    });

    it('sin el permiso 403; sin ser administradora, a la administradora no', async () => {
      const tokenCarla = await entrar('carla');
      const dario = await prisma.usuario.create({
        data: { nombreUsuario: 'dario', nombreCompleto: 'Darío', hashContrasena: 'h' },
      });
      await darRol(dario.id, sur, 'Ventas');
      await espera(
        enviar('post', `/usuarios/${dario.id}/quitar-acceso`, tokenCarla),
        403,
        SIN_PERMISO,
      );
      await permisosDelRol(rolCarla, 'auth.usuario.asignar_roles');
      await espera(
        enviar('post', `/usuarios/${anaId}/quitar-acceso`, tokenCarla),
        403,
        SOLO_ADMINISTRADOR,
      );
      await espera(enviar('post', `/usuarios/${dario.id}/quitar-acceso`, tokenCarla), 200);
    });
  });

  describe('GET /usuarios/roles-asignables (6.12b0)', () => {
    interface RolAsignableJson {
      id: string;
      nombre: string;
      descripcion: string | null;
      esAdministrador: boolean;
      sePuedeDar: boolean;
    }

    const asignables = async (token: string) => {
      const respuesta = await enviar('get', '/usuarios/roles-asignables', token);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Roles que se pueden dar');
      return respuesta.body.data as RolAsignableJson[];
    };

    it('los activos de Sur, el Administrador primero y por nombre sin tildes; la administradora da todos', async () => {
      await prisma.rol.create({
        data: { empresaId: sur, nombre: 'Ébano', descripcion: 'Sin nada' },
      });
      await prisma.rol.create({ data: { empresaId: sur, nombre: 'Archivo', activo: false } });
      const lista = await asignables(tokenAna);
      expect(lista.map((rol) => rol.nombre)).toEqual([
        'Administrador',
        'Caja',
        'Ébano',
        'Jefatura',
      ]);
      expect(lista.find((rol) => rol.nombre === 'Ébano')).toEqual({
        id: expect.any(String),
        nombre: 'Ébano',
        descripcion: 'Sin nada',
        esAdministrador: false,
        sePuedeDar: true,
      });
      expect(lista.every((rol) => rol.sePuedeDar)).toBe(true);
      // Nada de Zeta.
      const deZeta = await prisma.rol.findMany({ where: { empresaId: zeta } });
      expect(lista.some((rol) => deZeta.some((z) => z.id === rol.id))).toBe(false);
    });

    it('sin «Ver usuarios» 403; sin ser administradora, lo mismo que la API dejaría dar', async () => {
      const tokenCarla = await entrar('carla');
      await espera(enviar('get', '/usuarios/roles-asignables', tokenCarla), 403, SIN_PERMISO);
      await permisosDelRol(rolCarla, 'auth.usuario.ver', 'auth.usuario.asignar_roles');
      const contador = (await prisma.rol.create({ data: { empresaId: sur, nombre: 'Contador' } }))
        .id;
      await permisosDelRol(contador, 'auth.rol.ver');
      const sePuede = Object.fromEntries(
        (await asignables(tokenCarla)).map((rol) => [rol.nombre, rol.sePuedeDar]),
      );
      expect(sePuede).toEqual({
        Administrador: false,
        Caja: true,
        Contador: false,
        Jefatura: true,
      });
      // Lo que dice la lista es lo que hace la API.
      const dario = await prisma.usuario.create({
        data: { nombreUsuario: 'dario', nombreCompleto: 'Darío', hashContrasena: 'h' },
      });
      await darRol(dario.id, sur, 'Ventas');
      await espera(
        enviar('put', `/usuarios/${dario.id}/roles`, tokenCarla, { roles: [contador] }),
        403,
        NO_TIENE,
      );
      await espera(
        enviar('put', `/usuarios/${dario.id}/roles`, tokenCarla, { roles: [caja] }),
        200,
      );
    });
  });
});
