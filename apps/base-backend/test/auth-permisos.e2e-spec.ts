import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CATALOGO_PERMISOS } from '../src/catalogo-permisos.js';
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
import { limpiarBd } from './utilidades/limpiar-bd.js';

const CONTRASENA = 'Margarita-Lunes-47';
const DECLARADOS = CATALOGO_PERMISOS.flatMap((d) => Object.keys(d.permisos)).sort((a, b) =>
  a.localeCompare(b),
);

interface Respuesta {
  status: number;
  body: { success: boolean; data: { permisos: string[]; esAdministrador: boolean } };
}

/** Catálogo de permisos (6.6a) contra la base real: sincronización, tablas y GET /auth/sesion. */
describe('Permisos: catálogo y sesión (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sincronizar: SincronizarPermisosPort;
  /** Lo que había en la base apenas arrancó la app, antes del primer limpiarBd(). */
  let alArrancar: string[];

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    sincronizar = app.get(SINCRONIZAR_PERMISOS_PORT);
    alArrancar = await codigosGuardados();
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function codigosGuardados(obsoleto = false): Promise<string[]> {
    const filas = await prisma.permiso.findMany({
      where: { obsoleto },
      orderBy: { codigo: 'asc' },
    });
    return filas.map((p) => p.codigo);
  }

  describe('sincronización', () => {
    it('el arranque ya la corrió: al crear la app la base tenía todo el catálogo', () => {
      // (No se levanta otra app aquí: dos en el mismo proceso comparten piezas de nestjs-cls.)
      expect(alArrancar).toEqual(DECLARADOS);
    });

    it('crea todos, y la segunda vez no cambia nada', async () => {
      const primera = await sincronizar.execute();
      expect([...primera.creados]).toEqual(DECLARADOS);
      const antes = await prisma.permiso.findMany({ orderBy: { codigo: 'asc' } });

      await expect(sincronizar.execute()).resolves.toEqual({
        creados: [],
        actualizados: [],
        obsoletos: [],
      });
      expect(await prisma.permiso.findMany({ orderBy: { codigo: 'asc' } })).toEqual(antes);
    });

    it('actualiza la descripción, reactiva y marca obsoleto el que salió, sin borrar', async () => {
      await sincronizar.execute();
      await prisma.permiso.update({
        where: { codigo: 'auth.usuario.ver' },
        data: { descripcion: 'Texto viejo' },
      });
      await prisma.permiso.update({ where: { codigo: 'auth.rol.ver' }, data: { obsoleto: true } });
      await prisma.permiso.create({
        data: { codigo: 'auth.rol.borrar', descripcion: 'Borrar roles' },
      });

      await expect(sincronizar.execute()).resolves.toEqual({
        creados: [],
        actualizados: ['auth.rol.ver', 'auth.usuario.ver'],
        obsoletos: ['auth.rol.borrar'],
      });
      expect(await codigosGuardados()).toEqual(DECLARADOS);
      expect(await codigosGuardados(true)).toEqual(['auth.rol.borrar']);
      const usuarioVer = await prisma.permiso.findUniqueOrThrow({
        where: { codigo: 'auth.usuario.ver' },
      });
      expect(usuarioVer.descripcion).toBe('Ver usuarios');
    });

    it('dos servidores a la vez: uno espera al otro y no hay duplicados ni errores', async () => {
      const resultados = await Promise.all([sincronizar.execute(), sincronizar.execute()]);

      expect(resultados.map((r) => r.creados.length).sort((a, b) => a - b)).toEqual([
        0,
        DECLARADOS.length,
      ]);
      expect(await prisma.permiso.count()).toBe(DECLARADOS.length);
    });
  });

  describe('tablas', () => {
    it('la base rechaza un código sin el formato y una descripción vacía', async () => {
      await expect(
        prisma.permiso.create({ data: { codigo: 'Auth.usuario', descripcion: 'x' } }),
      ).rejects.toThrow(/permisos_codigo_formato_chk/u);
      await expect(
        prisma.permiso.create({ data: { codigo: 'auth.usuario.ver', descripcion: '  ' } }),
      ).rejects.toThrow(/permisos_descripcion_no_vacia_chk/u);
    });

    it('el rol Administrador no lleva permisos sueltos; un rol común sí', async () => {
      await sincronizar.execute();
      const { empresa } = await crearEmpresa('Comercial del Sur', 'ana');
      const administrador = await prisma.rol.findFirstOrThrow({
        where: { empresaId: empresa.id, esAdministrador: true },
      });
      const comun = await prisma.rol.create({ data: { empresaId: empresa.id, nombre: 'Caja' } });
      const permiso = await prisma.permiso.findUniqueOrThrow({
        where: { codigo: 'auth.usuario.ver' },
      });

      await expect(
        prisma.rolPermiso.create({ data: { rolId: administrador.id, permisoId: permiso.id } }),
      ).rejects.toThrow(/no lleva permisos sueltos/u);
      await expect(
        prisma.rolPermiso.create({ data: { rolId: comun.id, permisoId: permiso.id } }),
      ).resolves.toMatchObject({ rolId: comun.id });
    });
  });

  describe('GET /auth/sesion', () => {
    const servidor = () => app.getHttpServer() as Parameters<typeof request>[0];

    async function verSesion(nombreUsuario: string): Promise<Respuesta> {
      const login = (await request(servidor())
        .post('/api/v1/auth/login')
        .send({ nombreUsuario, contrasena: CONTRASENA })) as {
        body: { data: { tokenAcceso: string } };
      };
      return (await request(servidor())
        .get('/api/v1/auth/sesion')
        .set('Authorization', `Bearer ${login.body.data.tokenAcceso}`)) as Respuesta;
    }

    async function darPermisos(rolId: string, codigos: string[]): Promise<void> {
      const permisos = await prisma.permiso.findMany({ where: { codigo: { in: codigos } } });
      await prisma.rolPermiso.createMany({
        data: permisos.map((p) => ({ rolId, permisoId: p.id })),
      });
    }

    it('el Administrador recibe todos los vigentes; los demás, los de sus roles activos', async () => {
      await sincronizar.execute();
      await prisma.permiso.create({
        data: { codigo: 'auth.rol.borrar', descripcion: 'Borrar roles', obsoleto: true },
      });
      const { empresa } = await crearEmpresa('Comercial del Sur', 'ana');
      const otra = await crearEmpresa('Zeta Servicios', 'carla');
      const beto = await prisma.usuario.create({
        data: { nombreUsuario: 'beto', nombreCompleto: 'Beto Ruiz', hashContrasena: 'x' },
      });
      // Beto con la misma contraseña que ana (copiada del hash) y sin contraseña temporal.
      const ana = await prisma.usuario.findUniqueOrThrow({ where: { nombreUsuario: 'ana' } });
      await prisma.usuario.update({
        where: { id: beto.id },
        data: { hashContrasena: ana.hashContrasena, ultimaEmpresaId: empresa.id },
      });
      const consulta = await prisma.rol.create({
        data: { empresaId: empresa.id, nombre: 'Consulta' },
      });
      const caja = await prisma.rol.create({ data: { empresaId: empresa.id, nombre: 'Caja' } });
      const viejo = await prisma.rol.create({
        data: { empresaId: empresa.id, nombre: 'Viejo', activo: false },
      });
      const enZeta = await prisma.rol.create({
        data: { empresaId: otra.empresa.id, nombre: 'Zeta' },
      });
      for (const rol of [consulta, caja, viejo, enZeta]) {
        await prisma.usuarioRol.create({
          data: { usuarioId: beto.id, empresaId: rol.empresaId, rolId: rol.id },
        });
      }
      await darPermisos(consulta.id, ['auth.usuario.ver', 'auth.rol.ver', 'auth.rol.borrar']);
      await darPermisos(caja.id, ['auth.usuario.ver']);
      await darPermisos(viejo.id, ['auth.usuario.desactivar']);
      await darPermisos(enZeta.id, ['empresas.empresa.editar']);
      await prisma.usuario.updateMany({ data: { debeCambiarContrasena: false } });

      const deAna = await verSesion('ana');
      expect(deAna.status).toBe(200);
      expect(deAna.body.data.esAdministrador).toBe(true);
      expect(deAna.body.data.permisos).toEqual(DECLARADOS);

      const deBeto = await verSesion('beto');
      expect(deBeto.status).toBe(200);
      expect(deBeto.body.data.esAdministrador).toBe(false);
      expect(deBeto.body.data.permisos).toEqual(['auth.rol.ver', 'auth.usuario.ver']);
    });
  });

  function crearEmpresa(nombreEmpresa: string, nombreUsuario: string) {
    return app.get<CrearEmpresaConAdministradorPort>(CREAR_EMPRESA_CON_ADMINISTRADOR_PORT).crear(
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
  }
});
