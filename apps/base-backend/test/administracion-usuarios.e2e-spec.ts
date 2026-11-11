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
const OTRA_EMPRESA =
  'Este usuario también trabaja en otra empresa: solo puede hacer este cambio quien lo administre en todas';

interface Respuesta {
  status: number;
  body: { success: boolean; data: unknown; message: string };
}

interface RolJson {
  id: string;
  nombre: string;
  esAdministrador: boolean;
  activo: boolean;
}

interface UsuarioJson {
  id: string;
  nombreUsuario: string;
  nombreCompleto: string;
  activo: boolean;
  bloqueadoHasta: string | null;
  ultimoIngresoEn: string | null;
  roles: RolJson[];
  debeCambiarContrasena?: boolean;
  trabajaEnOtrasEmpresas?: boolean;
  sesiones?: { id: string; ip: string | null; navegador: string | null }[];
}

interface PaginaJson {
  elementos: UsuarioJson[];
  total: number;
  pagina: number;
  tamano: number;
}

/** 6.7c: los usuarios de la empresa activa (lista, ficha y editar el nombre), con la base real. */
describe('Administración: usuarios (e2e)', () => {
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
    rolCarla = (await prisma.rol.create({ data: { empresaId: sur, nombre: 'Jefatura' } })).id;
    await prisma.usuarioRol.create({
      data: { usuarioId: carlaId, empresaId: sur, rolId: rolCarla },
    });
    administradorSur = (
      await prisma.rol.findFirstOrThrow({ where: { empresaId: sur, esAdministrador: true } })
    ).id;
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

  async function entrar(nombreUsuario: string): Promise<string> {
    const respuesta = (await request(servidor())
      .post('/api/v1/auth/login')
      .set('User-Agent', 'Navegador de prueba')
      .send({ nombreUsuario, contrasena: CONTRASENA })) as Respuesta;
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

  const enviar = (
    metodo: 'get' | 'patch',
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

  describe('GET /usuarios', () => {
    it('los de su empresa, por nombre sin tildes, con sus roles en ella (no los de otra)', async () => {
      await darRol(carlaId, sur, 'Ámbar', false);
      await darRol(carlaId, zeta, 'Caja de Zeta');
      await prisma.usuario.update({
        where: { id: carlaId },
        data: { debeCambiarContrasena: true },
      });
      const respuesta = await enviar('get', '/usuarios', tokenAna);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Usuarios');
      const pagina = respuesta.body.data as PaginaJson;
      expect(pagina).toMatchObject({ total: 2, pagina: 1, tamano: 20 });
      expect(pagina.elementos.map((u) => u.nombreUsuario)).toEqual(['ana', 'carla']);
      expect(pagina.elementos[0]).toEqual({
        id: anaId,
        nombreUsuario: 'ana',
        nombreCompleto: 'ana',
        activo: true,
        bloqueadoHasta: null,
        ultimoIngresoEn: expect.any(String) as unknown,
        debeCambiarContrasena: false,
        roles: [
          { id: administradorSur, nombre: 'Administrador', esAdministrador: true, activo: true },
        ],
      });
      expect(pagina.elementos[1]?.roles.map((r) => [r.nombre, r.activo])).toEqual([
        ['Ámbar', false],
        ['Jefatura', true],
      ]);
      expect(pagina.elementos[1]?.debeCambiarContrasena).toBe(true);
      expect(JSON.stringify(pagina)).not.toContain('hash');
    });

    it('filtros (texto en el nombre o el usuario, sin tildes, % y _ literales; activo; rol) y páginas', async () => {
      const dario = await prisma.usuario.create({
        data: {
          nombreUsuario: 'dario_m',
          nombreCompleto: 'Darío Muñoz 100%',
          hashContrasena: 'h',
          activo: false,
          bloqueadoHasta: new Date(Date.now() + 600_000),
        },
      });
      const caja = await darRol(dario.id, sur, 'Caja');
      const nombres = async (consulta: string) =>
        (
          (await enviar('get', `/usuarios?${consulta}`, tokenAna)).body.data as PaginaJson
        ).elementos.map((u) => u.nombreUsuario);
      expect(await nombres('texto=MUNOZ')).toEqual(['dario_m']);
      expect(await nombres('texto=VERA')).toEqual(['carla']);
      expect(await nombres('texto=rio_')).toEqual(['dario_m']);
      expect(await nombres(`texto=${encodeURIComponent('0%')}`)).toEqual(['dario_m']);
      expect(await nombres('texto=a_a')).toEqual([]);
      expect(await nombres('activo=false')).toEqual(['dario_m']);
      expect(await nombres('activo=true')).toEqual(['ana', 'carla']);
      expect(await nombres(`rolId=${caja}`)).toEqual(['dario_m']);
      // Un rol de otra empresa no da a nadie.
      const deZeta = await darRol(betoId, zeta, 'Caja');
      expect(await nombres(`rolId=${deZeta}`)).toEqual([]);
      const bloqueado = (
        (await enviar('get', '/usuarios?activo=false', tokenAna)).body.data as PaginaJson
      ).elementos[0];
      expect(bloqueado?.bloqueadoHasta).not.toBeNull();

      const segunda = (await enviar('get', '/usuarios?pagina=2&tamano=2', tokenAna)).body
        .data as PaginaJson;
      expect(segunda).toMatchObject({ total: 3, pagina: 2, tamano: 2 });
      expect(segunda.elementos.map((u) => u.nombreUsuario)).toEqual(['dario_m']);
    });

    it('filtros mal escritos: 400 con su mensaje', async () => {
      const casos: [string, string][] = [
        ['activo=si', 'El filtro activo debe ser true o false'],
        ['rolId=abc', 'El rol a filtrar no es válido'],
        [`texto=${'x'.repeat(151)}`, 'El texto a buscar no puede pasar de 150 caracteres'],
        ['pagina=0', 'La página empieza en 1'],
      ];
      for (const [consulta, mensaje] of casos) {
        const respuesta = await enviar('get', `/usuarios?${consulta}`, tokenAna);
        expect(respuesta.status).toBe(400);
        expect(respuesta.body.message).toBe(mensaje);
      }
    });

    it('sin sesión 401; sin el permiso 403; con auth.usuario.ver, 200', async () => {
      expect((await enviar('get', '/usuarios', null)).status).toBe(401);
      const tokenCarla = await entrar('carla');
      const sinPermiso = await enviar('get', '/usuarios', tokenCarla);
      expect(sinPermiso.status).toBe(403);
      expect(sinPermiso.body.message).toBe(SIN_PERMISO);
      await permisosDelRol(rolCarla, 'auth.usuario.ver');
      expect((await enviar('get', '/usuarios', tokenCarla)).status).toBe(200);
    });
  });

  describe('GET /usuarios/:id', () => {
    it('la ficha: datos, roles y solo las sesiones abiertas de esta empresa', async () => {
      await entrar('carla');
      await darRol(carlaId, zeta, 'Caja de Zeta');
      // Una sesión de Carla en Zeta y una cerrada en Sur: no salen.
      const base = {
        usuarioId: carlaId,
        hashRefresh: 'a'.repeat(64),
        iniciadaEn: new Date(),
        venceEn: new Date(Date.now() + 3_600_000),
        ultimoUsoEn: new Date(),
      };
      await prisma.sesion.create({ data: { ...base, empresaId: zeta } });
      await prisma.sesion.create({
        data: { ...base, empresaId: sur, cerradaEn: new Date(), motivoCierre: 'SALIDA' },
      });

      const respuesta = await enviar('get', `/usuarios/${carlaId}`, tokenAna);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Datos del usuario');
      const ficha = respuesta.body.data as UsuarioJson;
      expect(ficha).toMatchObject({
        id: carlaId,
        nombreUsuario: 'carla',
        nombreCompleto: 'Carla Vera',
        activo: true,
        bloqueadoHasta: null,
        debeCambiarContrasena: false,
        trabajaEnOtrasEmpresas: true,
        roles: [{ id: rolCarla, nombre: 'Jefatura', esAdministrador: false, activo: true }],
      });
      expect(ficha.ultimoIngresoEn).not.toBeNull();
      expect(ficha.sesiones).toHaveLength(1);
      expect(ficha.sesiones?.[0]).toMatchObject({ navegador: 'Navegador de prueba' });
      expect(JSON.stringify(ficha)).not.toMatch(/hash|token/iu);
    });

    it('trabajaEnOtrasEmpresas: no cuenta una empresa desactivada', async () => {
      await darRol(carlaId, zeta, 'Caja de Zeta');
      await prisma.empresa.update({ where: { id: zeta }, data: { activo: false } });
      const ficha = (await enviar('get', `/usuarios/${carlaId}`, tokenAna)).body
        .data as UsuarioJson;
      expect(ficha.trabajaEnOtrasEmpresas).toBe(false);
    });

    it('uno de otra empresa o que no existe: 404; un id mal escrito: 400', async () => {
      for (const id of [betoId, '0190a4f2-1c2b-7000-8000-000000000999']) {
        const respuesta = await enviar('get', `/usuarios/${id}`, tokenAna);
        expect(respuesta.status).toBe(404);
        expect(respuesta.body.message).toBe(NO_EXISTE);
      }
      const mal = await enviar('get', '/usuarios/abc', tokenAna);
      expect(mal.status).toBe(400);
      expect(mal.body.message).toBe('El id no es válido');
    });
  });

  describe('PATCH /usuarios/:id', () => {
    it('cambia el nombre limpio, guarda quién lo hizo y lo registra en la bitácora', async () => {
      const respuesta = await enviar('patch', `/usuarios/${carlaId}`, tokenAna, {
        nombreCompleto: '  Carla   Vera Ruiz ',
      });
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Usuario actualizado');
      expect((respuesta.body.data as UsuarioJson).nombreCompleto).toBe('Carla Vera Ruiz');
      const guardada = await prisma.usuario.findUniqueOrThrow({ where: { id: carlaId } });
      expect(guardada).toMatchObject({ nombreCompleto: 'Carla Vera Ruiz', actualizadoPor: anaId });
      const [evento] = await eventos('auth.usuario.editar');
      expect(evento).toMatchObject({
        empresaId: sur,
        usuarioId: anaId,
        entidad: 'usuario',
        entidadId: carlaId,
        antes: { nombreCompleto: 'Carla Vera' },
        despues: { nombreCompleto: 'Carla Vera Ruiz' },
      });
    });

    it('matriz de null: ausente o igual no cambia nada; null, vacío, espacios, número, largo o campo de más: 400', async () => {
      for (const cuerpo of [{}, { nombreCompleto: 'Carla Vera' }]) {
        const respuesta = await enviar('patch', `/usuarios/${carlaId}`, tokenAna, cuerpo);
        expect(respuesta.status).toBe(200);
      }
      const casos: [unknown, string | null][] = [
        [{ nombreCompleto: null }, 'El nombre completo es obligatorio y debe ser texto'],
        [{ nombreCompleto: '' }, 'El nombre completo es obligatorio'],
        [{ nombreCompleto: '   ' }, 'El nombre completo es obligatorio'],
        [{ nombreCompleto: 12 }, 'El nombre completo es obligatorio y debe ser texto'],
        [
          { nombreCompleto: 'x'.repeat(151) },
          'El nombre completo no puede pasar de 150 caracteres',
        ],
        [{ nombreCompleto: 'Otra', nombreUsuario: 'otra' }, null],
      ];
      for (const [cuerpo, mensaje] of casos) {
        const respuesta = await enviar('patch', `/usuarios/${carlaId}`, tokenAna, cuerpo);
        expect(respuesta.status).toBe(400);
        if (mensaje !== null) {
          expect(respuesta.body.message).toBe(mensaje);
        }
      }
      const guardada = await prisma.usuario.findUniqueOrThrow({ where: { id: carlaId } });
      expect(guardada).toMatchObject({ nombreCompleto: 'Carla Vera', nombreUsuario: 'carla' });
      expect(await prisma.eventoAuditoria.count()).toBe(0);
    });

    it('uno de otra empresa: 404 y no se toca', async () => {
      const respuesta = await enviar('patch', `/usuarios/${betoId}`, tokenAna, {
        nombreCompleto: 'Otro',
      });
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.message).toBe(NO_EXISTE);
      expect(
        (await prisma.usuario.findUniqueOrThrow({ where: { id: betoId } })).nombreCompleto,
      ).toBe('beto');
    });

    it('sin el permiso 403; con auth.usuario.editar (sin ser administradora), 200', async () => {
      const tokenCarla = await entrar('carla');
      const sinPermiso = await enviar('patch', `/usuarios/${anaId}`, tokenCarla, {
        nombreCompleto: 'Ana',
      });
      expect(sinPermiso.status).toBe(403);
      expect(sinPermiso.body.message).toBe(SIN_PERMISO);
      await permisosDelRol(rolCarla, 'auth.usuario.editar');
      const conPermiso = await enviar('patch', `/usuarios/${anaId}`, tokenCarla, {
        nombreCompleto: 'Ana Pérez',
      });
      expect(conPermiso.status).toBe(200);
    });

    describe('AUTH-D12: Carla también trabaja en Zeta', () => {
      let rolCarlaZeta: string;

      beforeEach(async () => {
        rolCarlaZeta = await darRol(carlaId, zeta, 'Caja de Zeta');
      });

      it('la administradora de Sur no puede (403), aunque no cambie nada, y no se toca', async () => {
        for (const cuerpo of [{ nombreCompleto: 'Otra' }, {}]) {
          const respuesta = await enviar('patch', `/usuarios/${carlaId}`, tokenAna, cuerpo);
          expect(respuesta.status).toBe(403);
          expect(respuesta.body.message).toBe(OTRA_EMPRESA);
        }
        // Con un rol desactivado en Zeta, Carla sigue contando como de Zeta.
        await prisma.rol.update({ where: { id: rolCarlaZeta }, data: { activo: false } });
        expect(
          (await enviar('patch', `/usuarios/${carlaId}`, tokenAna, { nombreCompleto: 'Otra' }))
            .status,
        ).toBe(403);
        const guardada = await prisma.usuario.findUniqueOrThrow({ where: { id: carlaId } });
        expect(guardada.nombreCompleto).toBe('Carla Vera');
        expect(await prisma.eventoAuditoria.count()).toBe(0);
      });

      it('con el permiso también en Zeta, puede', async () => {
        const rolAnaZeta = await darRol(anaId, zeta, 'Personal');
        await permisosDelRol(rolAnaZeta, 'auth.usuario.ver');
        expect(
          (await enviar('patch', `/usuarios/${carlaId}`, tokenAna, { nombreCompleto: 'Otra' }))
            .status,
        ).toBe(403);
        await permisosDelRol(rolAnaZeta, 'auth.usuario.editar');
        const respuesta = await enviar('patch', `/usuarios/${carlaId}`, tokenAna, {
          nombreCompleto: 'Carla de las dos',
        });
        expect(respuesta.status).toBe(200);
        expect(await eventos('auth.usuario.editar')).toHaveLength(1);
      });

      it('si Zeta está desactivada, ya no cuenta', async () => {
        await prisma.empresa.update({ where: { id: zeta }, data: { activo: false } });
        const respuesta = await enviar('patch', `/usuarios/${carlaId}`, tokenAna, {
          nombreCompleto: 'Carla Sola',
        });
        expect(respuesta.status).toBe(200);
      });
    });
  });
});
