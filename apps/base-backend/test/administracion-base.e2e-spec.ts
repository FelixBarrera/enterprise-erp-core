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

/** 6.7a: `GET /permisos`, `GET /empresa` y `PATCH /empresa`, con la base real. */
describe('Administración: permisos y empresa (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sur: string;
  let zeta: string;
  let anaId: string;
  let carlaId: string;

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
    // Carla trabaja en Sur con el rol «Consulta», sin permisos.
    const carla = await prisma.usuario.create({
      data: {
        nombreUsuario: 'carla',
        nombreCompleto: 'Carla Vera',
        hashContrasena: ana.hashContrasena,
        ultimaEmpresaId: sur,
      },
    });
    carlaId = carla.id;
    const consulta = await prisma.rol.create({ data: { empresaId: sur, nombre: 'Consulta' } });
    await prisma.usuarioRol.create({
      data: { usuarioId: carlaId, empresaId: sur, rolId: consulta.id },
    });
    await prisma.usuario.updateMany({ data: { debeCambiarContrasena: false } });
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

  /** Le da a Carla, en Sur, un rol con ese permiso. */
  async function darPermisoACarla(codigo: string): Promise<void> {
    const rol = await prisma.rol.create({ data: { empresaId: sur, nombre: `Con ${codigo}` } });
    await prisma.usuarioRol.create({ data: { usuarioId: carlaId, empresaId: sur, rolId: rol.id } });
    const permiso = await prisma.permiso.findUniqueOrThrow({ where: { codigo } });
    await prisma.rolPermiso.create({ data: { rolId: rol.id, permisoId: permiso.id } });
  }

  async function entrar(nombreUsuario: string): Promise<string> {
    const respuesta = (await request(servidor())
      .post('/api/v1/auth/login')
      .send({ nombreUsuario, contrasena: CONTRASENA })) as Respuesta;
    expect(respuesta.status).toBe(200);
    return (respuesta.body.data as { tokenAcceso: string }).tokenAcceso;
  }

  const get = (ruta: string, token: string | null): Promise<Respuesta> => {
    const peticion = request(servidor()).get(`/api/v1${ruta}`);
    return token === null ? peticion : peticion.set('Authorization', `Bearer ${token}`);
  };

  const patchEmpresa = (token: string, cuerpo: unknown): Promise<Respuesta> =>
    request(servidor())
      .patch('/api/v1/empresa')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(cuerpo));

  /** Solo los de editar la empresa (el login también deja los suyos). */
  const eventosEditar = () =>
    prisma.eventoAuditoria.findMany({ where: { accion: 'empresas.empresa.editar' } });

  const nombreEnBase = async (id: string) =>
    (await prisma.empresa.findUniqueOrThrow({ where: { id } })).nombre;

  describe('GET /permisos', () => {
    it('el Administrador ve el catálogo por módulo, con los nombres, en el orden declarado', async () => {
      const respuesta = await get('/permisos', await entrar('ana'));
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Catálogo de permisos');
      const grupos = respuesta.body.data as {
        modulo: string;
        nombre: string;
        permisos: { codigo: string; descripcion: string }[];
      }[];
      expect(grupos.map((g) => [g.modulo, g.nombre])).toEqual([
        ['auth', 'Usuarios y roles'],
        ['auditoria', 'Bitácora'],
        ['empresas', 'Empresa'],
      ]);
      expect(grupos[0]?.permisos[0]).toEqual({
        codigo: 'auth.usuario.ver',
        descripcion: 'Ver usuarios',
      });
      // Son exactamente los vigentes de la base.
      const vigentes = await prisma.permiso.findMany({ where: { obsoleto: false } });
      expect(grupos.flatMap((g) => g.permisos.map((p) => p.codigo)).sort()).toEqual(
        vigentes.map((p) => p.codigo).sort(),
      );
    });

    it('sin auth.rol.ver, 403; con él, 200; sin sesión, 401', async () => {
      const respuesta = await get('/permisos', await entrar('carla'));
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.message).toBe(SIN_PERMISO);
      await darPermisoACarla('auth.rol.ver');
      expect((await get('/permisos', await entrar('carla'))).status).toBe(200);
      expect((await get('/permisos', null)).status).toBe(401);
    });
  });

  describe('GET /empresa', () => {
    it('cualquiera con sesión ve su empresa activa (sin permisos)', async () => {
      const respuesta = await get('/empresa', await entrar('carla'));
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        success: true,
        data: { id: sur, nombre: 'Comercial del Sur' },
        message: 'Datos de la empresa',
      });
      expect((await get('/empresa', null)).status).toBe(401);
    });
  });

  describe('PATCH /empresa', () => {
    it('cambia el nombre de la empresa activa, guarda quién y lo deja en la bitácora', async () => {
      const respuesta = await patchEmpresa(await entrar('ana'), {
        nombre: '  Comercial   Andina ',
      });
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        success: true,
        data: { id: sur, nombre: 'Comercial Andina' },
        message: 'Empresa actualizada',
      });
      const fila = await prisma.empresa.findUniqueOrThrow({ where: { id: sur } });
      expect(fila).toMatchObject({ nombre: 'Comercial Andina', actualizadoPor: anaId });
      expect(await nombreEnBase(zeta)).toBe('Zeta Servicios');
      const eventos = await eventosEditar();
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        accion: 'empresas.empresa.editar',
        empresaId: sur,
        usuarioId: anaId,
        nombreUsuario: 'ana',
        entidad: 'empresa',
        entidadId: sur,
        antes: { nombre: 'Comercial del Sur' },
        despues: { nombre: 'Comercial Andina' },
      });
      // La sesión ya muestra el nombre nuevo.
      const sesion = await get('/auth/sesion', await entrar('ana'));
      expect((sesion.body.data as { empresaActiva: { nombre: string } }).empresaActiva.nombre).toBe(
        'Comercial Andina',
      );
    });

    it('sin el campo, o con el mismo nombre: 200 y no cambia nada ni registra', async () => {
      const token = await entrar('ana');
      for (const cuerpo of [{}, { nombre: 'Comercial del Sur' }]) {
        const respuesta = await patchEmpresa(token, cuerpo);
        expect(respuesta.status).toBe(200);
        expect(respuesta.body.data).toEqual({ id: sur, nombre: 'Comercial del Sur' });
      }
      expect(await eventosEditar()).toHaveLength(0);
    });

    it.each([
      ['null', { nombre: null }, 'El nombre de la empresa es obligatorio y debe ser texto'],
      ['vacío', { nombre: '' }, 'El nombre de la empresa es obligatorio'],
      ['espacios', { nombre: '   ' }, 'El nombre de la empresa es obligatorio'],
      ['número', { nombre: 123 }, 'El nombre de la empresa es obligatorio y debe ser texto'],
      [
        '151 caracteres',
        { nombre: 'x'.repeat(151) },
        'El nombre de la empresa no puede pasar de 150 caracteres',
      ],
      ['enorme', { nombre: 'x'.repeat(1001) }, 'El nombre de la empresa es demasiado largo'],
      ['con el id', { nombre: 'Otra', id: 'x' }, 'El campo id no está permitido'],
    ])('nombre %s → 400, sin tocar la base', async (_caso, cuerpo, mensaje) => {
      const respuesta = await patchEmpresa(await entrar('ana'), cuerpo);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toEqual({ success: false, data: null, message: mensaje });
      expect(await nombreEnBase(sur)).toBe('Comercial del Sur');
      expect(await eventosEditar()).toHaveLength(0);
    });

    it('el nombre de otra empresa activa (sin importar mayúsculas ni tildes): 409', async () => {
      const respuesta = await patchEmpresa(await entrar('ana'), { nombre: 'ZETA SERVICÍOS' });
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.message).toBe('Ya existe una empresa con ese nombre');
      expect(await nombreEnBase(sur)).toBe('Comercial del Sur');
      expect(await eventosEditar()).toHaveLength(0);
    });

    it('sin empresas.empresa.editar, 403; con él, puede', async () => {
      const respuesta = await patchEmpresa(await entrar('carla'), { nombre: 'Otra' });
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.message).toBe(SIN_PERMISO);
      await darPermisoACarla('empresas.empresa.editar');
      expect((await patchEmpresa(await entrar('carla'), { nombre: 'Otra' })).status).toBe(200);
      expect(await nombreEnBase(sur)).toBe('Otra');
    });
  });
});
