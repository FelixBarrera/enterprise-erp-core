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

interface Respuesta {
  status: number;
  body: { success: boolean; data: unknown; message: string };
}

interface EventoJson {
  id: string;
  ocurridoEn: string;
  usuarioId: string | null;
  nombreUsuario: string | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  entidadNombre: string | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
  navegador?: string | null;
  requestId?: string | null;
}

interface PaginaJson {
  elementos: EventoJson[];
  total: number;
  pagina: number;
  tamano: number;
}

/** Ids fijos (UUID v7 válidos) para comparar el orden de desempate. */
const id = (n: number) => `0190a4f2-1c2b-7000-8000-${String(n).padStart(12, '0')}`;

/** 6.8: la consulta de la bitácora, con la base real. */
describe('Auditoría: consulta de la bitácora (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sur: string;
  let zeta: string;
  let anaId: string;
  let carlaId: string;
  let rolCarla: string;
  let tokenAna: string;
  let tokenCarla: string;

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
    const carla = await prisma.usuario.create({
      data: {
        nombreUsuario: 'carla',
        nombreCompleto: 'Carla Vera',
        hashContrasena: ana.hashContrasena,
        ultimaEmpresaId: sur,
      },
    });
    carlaId = carla.id;
    rolCarla = (await prisma.rol.create({ data: { empresaId: sur, nombre: 'Jefatura' } })).id;
    await prisma.usuarioRol.create({
      data: { usuarioId: carla.id, empresaId: sur, rolId: rolCarla },
    });
    await prisma.usuario.updateMany({ data: { debeCambiarContrasena: false } });
    tokenAna = await entrar('ana');
    tokenCarla = await entrar('carla');
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

  async function entrar(nombreUsuario: string): Promise<string> {
    const respuesta = (await request(servidor())
      .post('/api/v1/auth/login')
      .send({ nombreUsuario, contrasena: CONTRASENA })) as Respuesta;
    expect(respuesta.status).toBe(200);
    return (respuesta.body.data as { tokenAcceso: string }).tokenAcceso;
  }

  async function permisosDeCarla(...codigos: string[]): Promise<void> {
    await prisma.rolPermiso.deleteMany({ where: { rolId: rolCarla } });
    const permisos = await prisma.permiso.findMany({ where: { codigo: { in: codigos } } });
    await prisma.rolPermiso.createMany({
      data: permisos.map((p) => ({ rolId: rolCarla, permisoId: p.id })),
    });
  }

  const consultar = (ruta: string, token: string | null = tokenAna): Promise<Respuesta> => {
    const peticion = request(servidor()).get(`/api/v1/auditoria/eventos${ruta}`);
    return (
      token === null ? peticion : peticion.set('Authorization', `Bearer ${token}`)
    ) as Promise<Respuesta>;
  };

  const lista = async (consulta: string, token: string = tokenAna): Promise<PaginaJson> => {
    const respuesta = await consultar(`?${consulta}`, token);
    expect(respuesta.status).toBe(200);
    return respuesta.body.data as PaginaJson;
  };

  const acciones = async (consulta: string) =>
    (await lista(`desde=2026-11-01&hasta=2026-11-06&${consulta}`)).elementos.map((e) => e.accion);

  /** Un evento directo en la base (la tabla acepta INSERT). */
  const evento = (
    n: number,
    ocurridoEn: string,
    datos: Partial<{
      empresaId: string | null;
      usuarioId: string | null;
      nombreUsuario: string | null;
      accion: string;
      entidad: string;
      entidadId: string;
      entidadNombre: string;
    }> = {},
  ) => ({
    id: id(n),
    ocurridoEn: new Date(ocurridoEn),
    empresaId: sur,
    usuarioId: anaId,
    nombreUsuario: 'ana',
    accion: 'auth.usuario.editar',
    ...datos,
  });

  describe('GET /auditoria/eventos', () => {
    it('los de su empresa, por días de Guayaquil, del más nuevo al más viejo, sin antes ni después', async () => {
      await prisma.eventoAuditoria.createMany({
        data: [
          // 23:59:59 del 31 de octubre en Guayaquil (ya 1 de noviembre en UTC): fuera.
          evento(1, '2026-11-01T04:59:59.999Z'),
          // 00:00 del 1 de noviembre en Guayaquil: dentro.
          { ...evento(2, '2026-11-01T05:00:00Z'), antes: { a: 1 }, despues: { a: 2 } },
          // Dos a la misma hora: desempata el id (el mayor primero).
          evento(3, '2026-11-03T15:00:00Z'),
          evento(4, '2026-11-03T15:00:00Z'),
          // 23:59 del 6 en Guayaquil (ya 7 en UTC): dentro.
          evento(5, '2026-11-07T04:59:00Z'),
          // 00:00 del 7 en Guayaquil: fuera.
          evento(6, '2026-11-07T05:00:00Z'),
          // De otra empresa y sin empresa: nunca se ven (AUD-D5).
          evento(7, '2026-11-03T15:00:00Z', { empresaId: zeta }),
          evento(8, '2026-11-03T15:00:00Z', { empresaId: null, usuarioId: null }),
        ],
      });
      const respuesta = await consultar('?desde=2026-11-01&hasta=2026-11-06');
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Bitácora');
      const pagina = respuesta.body.data as PaginaJson;
      expect(pagina).toMatchObject({ total: 4, pagina: 1, tamano: 20 });
      expect(pagina.elementos.map((e) => e.id)).toEqual([id(5), id(4), id(3), id(2)]);
      expect(pagina.elementos[3]).toEqual({
        id: id(2),
        ocurridoEn: '2026-11-01T05:00:00.000Z',
        usuarioId: anaId,
        nombreUsuario: 'ana',
        accion: 'auth.usuario.editar',
        entidad: null,
        entidadId: null,
        entidadNombre: null,
      });
      // Páginas.
      const segunda = await lista('desde=2026-11-01&hasta=2026-11-06&pagina=2&tamano=3');
      expect(segunda).toMatchObject({ total: 4, pagina: 2, tamano: 3 });
      expect(segunda.elementos.map((e) => e.id)).toEqual([id(2)]);
    });

    it('filtros: usuario, acción exacta o por grupo (sin comodines), tipo de registro y registro', async () => {
      const otro = id(900);
      await prisma.eventoAuditoria.createMany({
        data: [
          evento(1, '2026-11-02T15:00:00Z', {
            accion: 'auth.usuario.crear',
            entidad: 'usuario',
            entidadId: otro,
          }),
          evento(2, '2026-11-02T16:00:00Z', {
            accion: 'auth.usuario.editar',
            entidad: 'usuario',
            entidadId: anaId,
          }),
          evento(3, '2026-11-02T17:00:00Z', {
            accion: 'auth.rol.crear',
            entidad: 'rol',
            entidadId: rolCarla,
          }),
          evento(4, '2026-11-02T18:00:00Z', { accion: 'auth.usuarios.x', usuarioId: otro }),
          evento(5, '2026-11-02T19:00:00Z', { accion: 'abc.recurso.crear' }),
        ],
      });
      expect(await acciones('accion=auth.usuario.crear')).toEqual(['auth.usuario.crear']);
      // El grupo trae lo de usuarios, no lo de «usuarios» (otro recurso).
      expect(await acciones('accion=auth.usuario')).toEqual([
        'auth.usuario.editar',
        'auth.usuario.crear',
      ]);
      expect(await acciones('accion=auth')).toEqual([
        'auth.usuarios.x',
        'auth.rol.crear',
        'auth.usuario.editar',
        'auth.usuario.crear',
      ]);
      // «_» es un carácter más, no un comodín de LIKE.
      expect(await acciones('accion=ab_')).toEqual([]);
      expect(await acciones(`usuarioId=${otro}`)).toEqual(['auth.usuarios.x']);
      expect(await acciones('entidad=usuario')).toEqual([
        'auth.usuario.editar',
        'auth.usuario.crear',
      ]);
      expect(await acciones(`entidad=usuario&entidadId=${anaId}`)).toEqual(['auth.usuario.editar']);
      expect(await acciones(`entidad=rol&entidadId=${anaId}`)).toEqual([]);
    });

    it('un evento real (el login) aparece con el día de hoy en la zona del negocio', async () => {
      await entrar('carla');
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(
        new Date(),
      );
      const pagina = await lista(`desde=${hoy}&hasta=${hoy}`);
      expect(pagina.elementos).toEqual([
        // El registro es la sesión y su nombre, el de su usuario (6.12c0b).
        expect.objectContaining({
          accion: 'auth.sesion.iniciar',
          nombreUsuario: 'carla',
          entidad: 'sesion',
          entidadNombre: 'carla',
        }),
      ]);
      // Consultar la bitácora no se registra en la bitácora.
      expect(await prisma.eventoAuditoria.count()).toBe(1);
    });

    it('la historia de un registro (6.12c0b): sin fechas ni tope de días, con su nombre', async () => {
      const deCarla = { entidad: 'usuario', entidadId: carlaId, entidadNombre: 'carla' };
      await prisma.eventoAuditoria.createMany({
        data: [
          evento(1, '2024-03-10T15:00:00Z', { ...deCarla, accion: 'auth.usuario.crear' }),
          evento(2, '2026-11-02T15:00:00Z', deCarla),
          // Otro registro y otra empresa: no salen.
          evento(3, '2026-11-02T16:00:00Z', { entidad: 'usuario', entidadId: anaId }),
          evento(4, '2026-11-02T17:00:00Z', { ...deCarla, empresaId: zeta }),
        ],
      });
      const historia = await lista(`entidad=usuario&entidadId=${carlaId}`);
      expect(historia.total).toBe(2);
      expect(historia.elementos.map((e) => [e.id, e.entidadNombre])).toEqual([
        [id(2), 'carla'],
        [id(1), 'carla'],
      ]);
      // Con fechas, se acota; desde 2020 hasta hoy pasa de 92 días y vale.
      expect((await lista(`entidad=usuario&entidadId=${carlaId}&desde=2026-01-01`)).total).toBe(1);
      expect(
        (await lista(`entidad=usuario&entidadId=${carlaId}&desde=2020-01-01&hasta=2026-11-06`))
          .total,
      ).toBe(2);
      // Al revés sigue siendo 400.
      const alReves = await consultar(
        `?entidad=usuario&entidadId=${carlaId}&desde=2026-11-06&hasta=2026-11-01`,
      );
      expect(alReves.status).toBe(400);
      expect(alReves.body.message).toBe('La fecha desde no puede ser mayor que la fecha hasta');
    });

    it.each([
      ['', 'La fecha desde es obligatoria y debe tener el formato aaaa-mm-dd'],
      // Solo el tipo no es la historia de un registro: las fechas siguen obligatorias.
      ['entidad=usuario', 'La fecha desde es obligatoria y debe tener el formato aaaa-mm-dd'],
      [`entidadId=${id(1)}`, 'Para buscar un registro hace falta su tipo (entidad), como texto'],
      ['desde=2026-11-01', 'La fecha hasta es obligatoria y debe tener el formato aaaa-mm-dd'],
      [
        'desde=01/11/2026&hasta=2026-11-06',
        'La fecha desde es obligatoria y debe tener el formato aaaa-mm-dd',
      ],
      ['desde=2026-11-06&hasta=2026-11-01', 'La fecha desde no puede ser mayor que la fecha hasta'],
      ['desde=2026-01-01&hasta=2026-04-03', 'El rango no puede pasar de 92 días'],
      ['desde=2026-02-30&hasta=2026-03-01', 'La fecha no es válida'],
      ['desde=2026-11-01&hasta=2026-11-06&usuarioId=x', 'El id del usuario no es válido'],
      [
        'desde=2026-11-01&hasta=2026-11-06&accion=Auth.Usuario',
        'La acción debe tener la forma modulo, modulo.recurso o modulo.recurso.accion',
      ],
      [
        'desde=2026-11-01&hasta=2026-11-06&accion=a.b.c.d',
        'La acción debe tener la forma modulo, modulo.recurso o modulo.recurso.accion',
      ],
      [
        `desde=2026-11-01&hasta=2026-11-06&entidadId=${id(1)}`,
        'Para buscar un registro hace falta su tipo (entidad), como texto',
      ],
      ['desde=2026-11-01&hasta=2026-11-06&entidad=', 'El tipo de registro no puede ir vacío'],
      [
        'desde=2026-11-01&hasta=2026-11-06&entidad=usuario&entidadId=1',
        'El id del registro no es válido',
      ],
      ['desde=2026-11-01&hasta=2026-11-06&pagina=0', 'La página empieza en 1'],
    ])('400 con «%s»', async (consulta, mensaje) => {
      const respuesta = await consultar(`?${consulta}`);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toMatchObject({ success: false, message: mensaje });
    });

    it('acepta 92 días justos', async () => {
      expect((await consultar('?desde=2026-01-01&hasta=2026-04-02')).status).toBe(200);
    });

    it('sin sesión 401; sin el permiso 403; con auditoria.evento.ver, la de su empresa', async () => {
      await prisma.eventoAuditoria.createMany({ data: [evento(1, '2026-11-02T15:00:00Z')] });
      expect((await consultar('?desde=2026-11-01&hasta=2026-11-06', null)).status).toBe(401);
      await permisosDeCarla('auth.usuario.ver');
      const prohibido = await consultar('?desde=2026-11-01&hasta=2026-11-06', tokenCarla);
      expect(prohibido.status).toBe(403);
      expect(prohibido.body.message).toBe(SIN_PERMISO);
      await permisosDeCarla('auditoria.evento.ver');
      expect((await lista('desde=2026-11-01&hasta=2026-11-06', tokenCarla)).total).toBe(1);
    });
  });

  describe('GET /auditoria/usuarios', () => {
    const usuarios = async (token: string = tokenAna) => {
      const respuesta = (await request(servidor())
        .get('/api/v1/auditoria/usuarios')
        .set('Authorization', `Bearer ${token}`)) as Respuesta;
      return respuesta;
    };

    it('quienes hicieron algo en su empresa, una vez cada uno, por nombre (también quien ya no está)', async () => {
      const dora = id(900);
      await prisma.eventoAuditoria.createMany({
        data: [
          evento(1, '2026-01-02T15:00:00Z'),
          evento(2, '2026-11-02T15:00:00Z'),
          evento(3, '2026-11-03T15:00:00Z', { usuarioId: dora, nombreUsuario: 'dora' }),
          evento(4, '2025-03-03T15:00:00Z', { usuarioId: carlaId, nombreUsuario: 'carla' }),
          // Sin usuario (un proceso del sistema) y de otra empresa: no salen.
          evento(5, '2026-11-04T15:00:00Z', { usuarioId: null, nombreUsuario: null }),
          evento(6, '2026-11-04T15:00:00Z', {
            empresaId: zeta,
            usuarioId: id(901),
            nombreUsuario: 'beto',
          }),
        ],
      });
      const respuesta = await usuarios();
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Usuarios de la bitácora');
      expect(respuesta.body.data).toEqual([
        { usuarioId: anaId, nombreUsuario: 'ana' },
        { usuarioId: carlaId, nombreUsuario: 'carla' },
        { usuarioId: dora, nombreUsuario: 'dora' },
      ]);
    });

    it('sin eventos, lista vacía', async () => {
      expect((await usuarios()).body.data).toEqual([]);
    });

    it('sin sesión 401; sin el permiso 403 (aunque vea usuarios); con auditoria.evento.ver, 200', async () => {
      await prisma.eventoAuditoria.createMany({ data: [evento(1, '2026-11-02T15:00:00Z')] });
      const sinSesion = (await request(servidor()).get('/api/v1/auditoria/usuarios')) as Respuesta;
      expect(sinSesion.status).toBe(401);
      await permisosDeCarla('auth.usuario.ver');
      const prohibido = await usuarios(tokenCarla);
      expect(prohibido.status).toBe(403);
      expect(prohibido.body.message).toBe(SIN_PERMISO);
      await permisosDeCarla('auditoria.evento.ver');
      expect((await usuarios(tokenCarla)).body.data).toEqual([
        { usuarioId: anaId, nombreUsuario: 'ana' },
      ]);
    });
  });

  describe('GET /auditoria/eventos/:id', () => {
    it('el evento completo, con antes, después y de dónde vino', async () => {
      await prisma.eventoAuditoria.create({
        data: {
          ...evento(1, '2026-11-02T15:00:00Z', {
            entidad: 'usuario',
            entidadId: anaId,
            entidadNombre: 'ana',
          }),
          antes: { nombreCompleto: 'Ana' },
          despues: { nombreCompleto: 'Ana Ruiz' },
          ip: '192.0.2.10',
          navegador: 'Prueba',
          requestId: 'r-1',
        },
      });
      const respuesta = await consultar(`/${id(1)}`);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Datos del evento');
      expect(respuesta.body.data).toEqual({
        id: id(1),
        ocurridoEn: '2026-11-02T15:00:00.000Z',
        usuarioId: anaId,
        nombreUsuario: 'ana',
        accion: 'auth.usuario.editar',
        entidad: 'usuario',
        entidadId: anaId,
        entidadNombre: 'ana',
        antes: { nombreCompleto: 'Ana' },
        despues: { nombreCompleto: 'Ana Ruiz' },
        ip: '192.0.2.10',
        navegador: 'Prueba',
        requestId: 'r-1',
      });
    });

    it('sin cambios: antes y después en null', async () => {
      await prisma.eventoAuditoria.create({ data: evento(1, '2026-11-02T15:00:00Z') });
      expect((await consultar(`/${id(1)}`)).body.data).toMatchObject({
        antes: null,
        despues: null,
      });
    });

    it('de otra empresa, sin empresa o que no existe: 404; id mal escrito: 400', async () => {
      await prisma.eventoAuditoria.createMany({
        data: [
          evento(1, '2026-11-02T15:00:00Z', { empresaId: zeta }),
          evento(2, '2026-11-02T15:00:00Z', { empresaId: null }),
        ],
      });
      for (const n of [1, 2, 3]) {
        const respuesta = await consultar(`/${id(n)}`);
        expect(respuesta.status).toBe(404);
        expect(respuesta.body.message).toBe('El evento no existe');
      }
      const mal = await consultar('/x');
      expect(mal.status).toBe(400);
      expect(mal.body.message).toBe('El id no es válido');
    });

    it('sin el permiso 403', async () => {
      await prisma.eventoAuditoria.create({ data: evento(1, '2026-11-02T15:00:00Z') });
      expect((await consultar(`/${id(1)}`, tokenCarla)).status).toBe(403);
    });
  });
});
