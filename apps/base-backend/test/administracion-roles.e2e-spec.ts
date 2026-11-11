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
const ESCALADA = 'No puede dar permisos que usted no tiene';
const ADMINISTRADOR_FIJO = 'El rol Administrador no se puede cambiar';
const NO_EXISTE = 'El rol no existe';

interface Respuesta {
  status: number;
  body: { success: boolean; data: unknown; message: string };
}

interface RolJson {
  id: string;
  nombre: string;
  descripcion: string | null;
  esAdministrador: boolean;
  activo: boolean;
  permisos: string[];
  cantidadUsuarios: number;
  creado: { en: string; por: string | null } | null;
  modificado: { en: string; por: string | null } | null;
}

interface PaginaJson {
  elementos: (Omit<RolJson, 'permisos'> & { cantidadPermisos: number })[];
  total: number;
  pagina: number;
  tamano: number;
}

/** 6.7b: los roles de la empresa activa, con la base real. */
describe('Administración: roles (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sur: string;
  let zeta: string;
  let anaId: string;
  let carlaId: string;
  /** El rol de Carla en Sur: el que le da los permisos de cada prueba. */
  let rolCarla: string;
  let administradorSur: string;
  let cajaZeta: string;
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
    cajaZeta = (await prisma.rol.create({ data: { empresaId: zeta, nombre: 'Caja' } })).id;
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
      .send({ nombreUsuario, contrasena: CONTRASENA })) as Respuesta;
    expect(respuesta.status).toBe(200);
    return (respuesta.body.data as { tokenAcceso: string }).tokenAcceso;
  }

  /** Le da al rol de Carla exactamente esos permisos (directo en la base). */
  async function permisosDeCarla(...codigos: string[]): Promise<void> {
    await prisma.rolPermiso.deleteMany({ where: { rolId: rolCarla } });
    const permisos = await prisma.permiso.findMany({ where: { codigo: { in: codigos } } });
    await prisma.rolPermiso.createMany({
      data: permisos.map((p) => ({ rolId: rolCarla, permisoId: p.id })),
    });
  }

  const enviar = (
    metodo: 'get' | 'post' | 'patch' | 'put',
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

  const crearRol = (token: string, cuerpo: unknown) => enviar('post', '/roles', token, cuerpo);

  /** Los códigos del rol en `roles_permisos`. */
  const codigosEnBase = async (rolId: string): Promise<string[]> =>
    (
      await prisma.rolPermiso.findMany({
        where: { rolId },
        select: { permiso: { select: { codigo: true } } },
      })
    )
      .map((f) => f.permiso.codigo)
      .sort();

  const eventos = (accion: string) => prisma.eventoAuditoria.findMany({ where: { accion } });

  describe('GET /roles', () => {
    it('los de su empresa: el Administrador primero, luego por nombre sin tildes; con sus cuentas', async () => {
      await prisma.rol.create({ data: { empresaId: sur, nombre: 'Ámbar', activo: false } });
      await permisosDeCarla('auth.rol.ver', 'auth.usuario.ver');
      const respuesta = await enviar('get', '/roles', tokenAna);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Roles');
      const pagina = respuesta.body.data as PaginaJson;
      expect(pagina).toMatchObject({ total: 3, pagina: 1, tamano: 20 });
      expect(pagina.elementos.map((r) => r.nombre)).toEqual(['Administrador', 'Ámbar', 'Jefatura']);
      const vigentes = await prisma.permiso.count({ where: { obsoleto: false } });
      expect(pagina.elementos[0]).toMatchObject({
        esAdministrador: true,
        cantidadPermisos: vigentes,
        cantidadUsuarios: 1,
      });
      expect(pagina.elementos[2]).toEqual({
        id: rolCarla,
        nombre: 'Jefatura',
        descripcion: null,
        esAdministrador: false,
        activo: true,
        cantidadPermisos: 2,
        cantidadUsuarios: 1,
      });
    });

    it('filtros (texto sin tildes ni mayúsculas, con % y _ literales; activo) y páginas', async () => {
      await prisma.rol.create({ data: { empresaId: sur, nombre: 'Ámbar', activo: false } });
      await prisma.rol.create({ data: { empresaId: sur, nombre: 'Cobro 100%' } });
      const nombres = async (consulta: string) =>
        (
          (await enviar('get', `/roles?${consulta}`, tokenAna)).body.data as PaginaJson
        ).elementos.map((r) => r.nombre);
      expect(await nombres('texto=AMB')).toEqual(['Ámbar']);
      expect(await nombres(`texto=${encodeURIComponent('0%')}`)).toEqual(['Cobro 100%']);
      expect(await nombres('texto=_')).toEqual([]);
      expect(await nombres('activo=false')).toEqual(['Ámbar']);
      expect(await nombres('activo=true')).toEqual(['Administrador', 'Cobro 100%', 'Jefatura']);
      const segunda = (await enviar('get', '/roles?pagina=2&tamano=3', tokenAna)).body
        .data as PaginaJson;
      expect(segunda.total).toBe(4);
      expect(segunda.elementos.map((r) => r.nombre)).toEqual(['Jefatura']);
    });

    it('filtros mal escritos: 400', async () => {
      for (const [consulta, mensaje] of [
        ['activo=si', 'El filtro activo debe ser true o false'],
        [`texto=${'a'.repeat(81)}`, 'El texto a buscar no puede pasar de 80 caracteres'],
        ['pagina=0', 'La página empieza en 1'],
        ['otro=1', 'El campo otro no está permitido'],
      ]) {
        const respuesta = await enviar('get', `/roles?${consulta}`, tokenAna);
        expect([respuesta.status, respuesta.body.message]).toEqual([400, mensaje]);
      }
    });

    it('sin el permiso, 403; con él, 200; sin sesión, 401', async () => {
      const tokenCarla = await entrar('carla');
      expect((await enviar('get', '/roles', tokenCarla)).body.message).toBe(SIN_PERMISO);
      await permisosDeCarla('auth.rol.ver');
      expect((await enviar('get', '/roles', tokenCarla)).status).toBe(200);
      expect((await enviar('get', '/roles', null)).status).toBe(401);
    });
  });

  describe('GET /roles/:id', () => {
    it('la ficha; el Administrador con todos los permisos', async () => {
      await permisosDeCarla('auth.usuario.ver', 'auth.rol.ver');
      const ficha = await enviar('get', `/roles/${rolCarla}`, tokenAna);
      expect(ficha.status).toBe(200);
      expect(ficha.body.data).toEqual({
        id: rolCarla,
        nombre: 'Jefatura',
        descripcion: null,
        esAdministrador: false,
        activo: true,
        permisos: ['auth.rol.ver', 'auth.usuario.ver'],
        cantidadUsuarios: 1,
        // Creado directo en la base: la bitácora no lo tiene.
        creado: null,
        modificado: null,
      });
      const admin = (await enviar('get', `/roles/${administradorSur}`, tokenAna)).body
        .data as RolJson;
      expect(admin.permisos).toHaveLength(
        await prisma.permiso.count({ where: { obsoleto: false } }),
      );
    });

    it('un rol de otra empresa: 404, igual que uno que no existe; id mal escrito: 400', async () => {
      for (const id of [cajaZeta, '0190a4f2-1c2b-7000-8000-000000000999']) {
        const respuesta = await enviar('get', `/roles/${id}`, tokenAna);
        expect([respuesta.status, respuesta.body.message]).toEqual([404, NO_EXISTE]);
      }
      expect((await enviar('get', '/roles/abc', tokenAna)).body.message).toBe('El id no es válido');
    });
  });

  describe('POST /roles', () => {
    it('crea con sus permisos, guarda quién y lo registra', async () => {
      const respuesta = await crearRol(tokenAna, {
        nombre: '  Caja   principal ',
        descripcion: 'Cobra',
        permisos: ['auth.usuario.ver', 'auth.rol.ver', 'auth.usuario.ver'],
      });
      expect(respuesta.status).toBe(201);
      expect(respuesta.body.message).toBe('Rol creado');
      const rol = respuesta.body.data as RolJson;
      expect(rol).toMatchObject({
        nombre: 'Caja principal',
        descripcion: 'Cobra',
        esAdministrador: false,
        activo: true,
        cantidadUsuarios: 0,
      });
      expect(rol.permisos.sort()).toEqual(['auth.rol.ver', 'auth.usuario.ver']);
      const fila = await prisma.rol.findUniqueOrThrow({ where: { id: rol.id } });
      expect(fila).toMatchObject({ empresaId: sur, creadoPor: anaId, actualizadoPor: anaId });
      expect(await codigosEnBase(rol.id)).toEqual(['auth.rol.ver', 'auth.usuario.ver']);
      const [evento] = await eventos('auth.rol.crear');
      expect(evento).toMatchObject({
        empresaId: sur,
        usuarioId: anaId,
        entidad: 'rol',
        entidadId: rol.id,
        entidadNombre: 'Caja principal',
        antes: null,
      });
      expect(evento?.despues).toMatchObject({ nombre: 'Caja principal', descripcion: 'Cobra' });
    });

    it('pie de la ficha (6.12a0): creado al crear; fijar permisos cuenta como modificado', async () => {
      const creado = (await crearRol(tokenAna, { nombre: 'Ventas' })).body.data as RolJson;
      expect(creado.creado).toEqual({ en: expect.any(String), por: 'ana' });
      expect(Number.isNaN(Date.parse(creado.creado?.en ?? ''))).toBe(false);
      expect(creado.modificado).toBeNull();

      const cambiado = await enviar('put', `/roles/${creado.id}/permisos`, tokenAna, {
        permisos: ['auth.rol.ver'],
      });
      expect((cambiado.body.data as RolJson).modificado?.por).toBe('ana');
      const ficha = (await enviar('get', `/roles/${creado.id}`, tokenAna)).body.data as RolJson;
      expect(ficha.creado?.por).toBe('ana');
      expect(ficha.modificado?.por).toBe('ana');
    });

    it('matriz de null', async () => {
      const casos: [unknown, number, string][] = [
        [{}, 400, 'El nombre del rol es obligatorio y debe ser texto'],
        [{ nombre: null }, 400, 'El nombre del rol es obligatorio y debe ser texto'],
        [{ nombre: '' }, 400, 'El nombre del rol es obligatorio'],
        [{ nombre: '   ' }, 400, 'El nombre del rol es obligatorio'],
        [{ nombre: 5 }, 400, 'El nombre del rol es obligatorio y debe ser texto'],
        [{ nombre: 'x'.repeat(81) }, 400, 'El nombre del rol no puede pasar de 80 caracteres'],
        [{ nombre: 'X', descripcion: 5 }, 400, 'La descripción del rol debe ser texto'],
        [{ nombre: 'X', permisos: null }, 400, 'Los permisos deben ser una lista'],
        [{ nombre: 'X', permisos: 'auth.rol.ver' }, 400, 'Los permisos deben ser una lista'],
        [{ nombre: 'X', permisos: [5] }, 400, 'Cada permiso debe ser texto'],
        [
          { nombre: 'X', permisos: ['no.existe.nada'] },
          400,
          'El permiso «no.existe.nada» no existe',
        ],
        [{ nombre: 'X', otro: 1 }, 400, 'El campo otro no está permitido'],
      ];
      for (const [cuerpo, estado, mensaje] of casos) {
        const respuesta = await crearRol(tokenAna, cuerpo);
        expect([JSON.stringify(cuerpo), respuesta.status, respuesta.body.message]).toEqual([
          JSON.stringify(cuerpo),
          estado,
          mensaje,
        ]);
      }
      expect(await prisma.rol.count({ where: { empresaId: sur } })).toBe(2);
      // Descripción ausente, null, vacía o con espacios: queda null (nunca '').
      for (const [nombre, descripcion] of [
        ['Uno', undefined],
        ['Dos', null],
        ['Tres', ''],
        ['Cuatro', '   '],
      ]) {
        const respuesta = await crearRol(tokenAna, { nombre, descripcion });
        expect(respuesta.status).toBe(201);
        expect((respuesta.body.data as RolJson).descripcion).toBeNull();
      }
      expect(
        await prisma.rol.count({
          where: { nombre: { in: ['Uno', 'Dos', 'Tres', 'Cuatro'] }, descripcion: null },
        }),
      ).toBe(4);
    });

    it('el nombre de otro activo (sin mayúsculas ni tildes): 409; el de uno desactivado o de otra empresa, no', async () => {
      const repetido = await crearRol(tokenAna, { nombre: 'JEFATURA' });
      expect([repetido.status, repetido.body.message]).toEqual([
        409,
        'Ya existe un rol con ese nombre',
      ]);
      expect((await crearRol(tokenAna, { nombre: 'Caja' })).status).toBe(201);
      await prisma.rol.update({ where: { id: rolCarla }, data: { activo: false } });
      expect((await crearRol(tokenAna, { nombre: 'Jefatura' })).status).toBe(201);
    });

    it('quien no es administrador solo da los permisos que tiene (AUTH-D11 (2))', async () => {
      await permisosDeCarla('auth.rol.crear', 'auth.usuario.ver');
      const tokenCarla = await entrar('carla');
      const negado = await crearRol(tokenCarla, {
        nombre: 'Más poder',
        permisos: ['auth.usuario.ver', 'auth.usuario.crear'],
      });
      expect([negado.status, negado.body.message]).toEqual([403, ESCALADA]);
      expect(await prisma.rol.count({ where: { nombre: 'Más poder' } })).toBe(0);
      const permitido = await crearRol(tokenCarla, {
        nombre: 'Consulta',
        permisos: ['auth.usuario.ver'],
      });
      expect(permitido.status).toBe(201);
    });
  });

  describe('PATCH /roles/:id', () => {
    const editar = (id: string, cuerpo: unknown) =>
      enviar('patch', `/roles/${id}`, tokenAna, cuerpo);

    it('cambia nombre y descripción, guarda quién y registra solo lo que cambió', async () => {
      const respuesta = await editar(rolCarla, {
        nombre: 'Jefa de caja',
        descripcion: 'Supervisa',
      });
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toMatchObject({
        message: 'Rol actualizado',
        data: { nombre: 'Jefa de caja', descripcion: 'Supervisa' },
      });
      expect(await prisma.rol.findUniqueOrThrow({ where: { id: rolCarla } })).toMatchObject({
        nombre: 'Jefa de caja',
        actualizadoPor: anaId,
      });
      const [evento] = await eventos('auth.rol.editar');
      expect(evento).toMatchObject({
        // Cómo quedó llamándose (6.12c0b).
        entidadNombre: 'Jefa de caja',
        antes: { nombre: 'Jefatura', descripcion: null },
        despues: { nombre: 'Jefa de caja', descripcion: 'Supervisa' },
      });
    });

    it('matriz de null', async () => {
      await prisma.rol.update({ where: { id: rolCarla }, data: { descripcion: 'Supervisa' } });
      const errores: [unknown, string][] = [
        [{ nombre: null }, 'El nombre del rol es obligatorio y debe ser texto'],
        [{ nombre: '' }, 'El nombre del rol es obligatorio'],
        [{ nombre: '  ' }, 'El nombre del rol es obligatorio'],
        [{ nombre: 5 }, 'El nombre del rol es obligatorio y debe ser texto'],
        [{ descripcion: 5 }, 'La descripción del rol debe ser texto'],
        [
          { descripcion: 'd'.repeat(251) },
          'La descripción del rol no puede pasar de 250 caracteres',
        ],
        [{ activo: false }, 'El campo activo no está permitido'],
      ];
      for (const [cuerpo, mensaje] of errores) {
        const respuesta = await editar(rolCarla, cuerpo);
        expect([respuesta.status, respuesta.body.message]).toEqual([400, mensaje]);
      }
      // Sin campos: queda igual y no registra.
      expect((await editar(rolCarla, {})).status).toBe(200);
      expect(await eventos('auth.rol.editar')).toEqual([]);
      // null, '' y espacios quitan la descripción.
      for (const descripcion of [null, '', '  ']) {
        await prisma.rol.update({ where: { id: rolCarla }, data: { descripcion: 'Supervisa' } });
        const respuesta = await editar(rolCarla, { descripcion });
        expect((respuesta.body.data as RolJson).descripcion).toBeNull();
        expect(
          (await prisma.rol.findUniqueOrThrow({ where: { id: rolCarla } })).descripcion,
        ).toBeNull();
      }
    });

    it('el Administrador: 422; uno de otra empresa: 404; nombre de otro activo: 409', async () => {
      const admin = await editar(administradorSur, { nombre: 'Jefe' });
      expect([admin.status, admin.body.message]).toEqual([422, ADMINISTRADOR_FIJO]);
      expect((await editar(cajaZeta, { nombre: 'Mía' })).status).toBe(404);
      expect((await prisma.rol.findUniqueOrThrow({ where: { id: cajaZeta } })).nombre).toBe('Caja');
      expect((await editar(rolCarla, { nombre: 'administrador' })).status).toBe(409);
    });
  });

  describe('PUT /roles/:id/permisos', () => {
    const fijar = (token: string, id: string, cuerpo: unknown) =>
      enviar('put', `/roles/${id}/permisos`, token, cuerpo);

    it('deja exactamente esos (también quita los obsoletos) y registra antes y después', async () => {
      await permisosDeCarla('auth.usuario.ver');
      const obsoleto = await prisma.permiso.create({
        data: { codigo: 'viejo.cosa.hacer', descripcion: 'x', obsoleto: true },
      });
      await prisma.rolPermiso.create({ data: { rolId: rolCarla, permisoId: obsoleto.id } });
      const respuesta = await fijar(tokenAna, rolCarla, {
        permisos: ['auth.rol.ver', 'empresas.empresa.editar'],
      });
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.message).toBe('Permisos del rol actualizados');
      expect((respuesta.body.data as RolJson).permisos.sort()).toEqual([
        'auth.rol.ver',
        'empresas.empresa.editar',
      ]);
      expect(await codigosEnBase(rolCarla)).toEqual(['auth.rol.ver', 'empresas.empresa.editar']);
      const [evento] = await eventos('auth.rol.permisos');
      expect(evento).toMatchObject({
        entidadId: rolCarla,
        antes: { permisos: ['auth.usuario.ver'] },
      });
      // Los mismos otra vez: no registra.
      await fijar(tokenAna, rolCarla, { permisos: ['empresas.empresa.editar', 'auth.rol.ver'] });
      expect(await eventos('auth.rol.permisos')).toHaveLength(1);
      // Lista vacía: ninguno.
      await fijar(tokenAna, rolCarla, { permisos: [] });
      expect(await codigosEnBase(rolCarla)).toEqual([]);
    });

    it('cambia los permisos al instante: el guard lee los de ahora', async () => {
      const tokenCarla = await entrar('carla');
      expect((await enviar('get', '/roles', tokenCarla)).status).toBe(403);
      await fijar(tokenAna, rolCarla, { permisos: ['auth.rol.ver'] });
      expect((await enviar('get', '/roles', tokenCarla)).status).toBe(200);
    });

    it('matriz de null', async () => {
      const casos: [unknown, string][] = [
        [{}, 'Los permisos son obligatorios y deben ser una lista'],
        [{ permisos: null }, 'Los permisos son obligatorios y deben ser una lista'],
        [{ permisos: '' }, 'Los permisos son obligatorios y deben ser una lista'],
        [{ permisos: [null] }, 'Cada permiso debe ser texto'],
        [{ permisos: [''] }, 'El permiso «» no existe'],
        [{ permisos: ['  auth.rol.ver '] }, 'El permiso «  auth.rol.ver » no existe'],
      ];
      for (const [cuerpo, mensaje] of casos) {
        const respuesta = await fijar(tokenAna, rolCarla, cuerpo);
        expect([respuesta.status, respuesta.body.message]).toEqual([400, mensaje]);
      }
      expect(await eventos('auth.rol.permisos')).toEqual([]);
    });

    it('AUTH-D11 (2): quien no es administrador quita cualquiera, solo agrega los suyos', async () => {
      await permisosDeCarla('auth.rol.editar', 'auth.usuario.ver');
      const caja = await prisma.rol.create({ data: { empresaId: sur, nombre: 'Caja' } });
      const tokenCarla = await entrar('carla');
      const negado = await fijar(tokenCarla, caja.id, { permisos: ['auth.usuario.crear'] });
      expect([negado.status, negado.body.message]).toEqual([403, ESCALADA]);
      expect(await codigosEnBase(caja.id)).toEqual([]);
      expect((await fijar(tokenCarla, caja.id, { permisos: ['auth.usuario.ver'] })).status).toBe(
        200,
      );
      // Ana le agrega uno que Carla no tiene; Carla igual puede quitarlo.
      await fijar(tokenAna, caja.id, { permisos: ['auth.usuario.ver', 'auth.usuario.crear'] });
      expect((await fijar(tokenCarla, caja.id, { permisos: [] })).status).toBe(200);
    });

    it('el Administrador: 422, sin filas; uno de otra empresa: 404', async () => {
      const admin = await fijar(tokenAna, administradorSur, { permisos: [] });
      expect([admin.status, admin.body.message]).toEqual([422, ADMINISTRADOR_FIJO]);
      expect(await codigosEnBase(administradorSur)).toEqual([]);
      expect((await fijar(tokenAna, cajaZeta, { permisos: ['auth.rol.ver'] })).status).toBe(404);
      expect(await codigosEnBase(cajaZeta)).toEqual([]);
    });
  });

  describe('POST /roles/:id/desactivar y /reactivar', () => {
    const accion = (token: string, id: string, que: 'desactivar' | 'reactivar') =>
      enviar('post', `/roles/${id}/${que}`, token);

    it('desactivar quita sus permisos al instante (las asignaciones quedan); reactivar los devuelve', async () => {
      await permisosDeCarla('auth.rol.ver');
      const tokenCarla = await entrar('carla');
      expect((await enviar('get', '/roles', tokenCarla)).status).toBe(200);
      const desactivado = await accion(tokenAna, rolCarla, 'desactivar');
      expect(desactivado.status).toBe(200);
      expect(desactivado.body).toMatchObject({
        message: 'Rol desactivado',
        data: { activo: false },
      });
      expect(await prisma.usuarioRol.count({ where: { rolId: rolCarla } })).toBe(1);
      // Sin otro rol activo, Carla se queda sin acceso a la empresa: su sesión deja de valer.
      expect((await enviar('get', '/roles', tokenCarla)).status).not.toBe(200);
      const reactivado = await accion(tokenAna, rolCarla, 'reactivar');
      expect(reactivado.body).toMatchObject({ message: 'Rol reactivado', data: { activo: true } });
      expect((await enviar('get', '/roles', tokenCarla)).status).toBe(200);
      const registrados = await prisma.eventoAuditoria.findMany({
        where: { entidadId: rolCarla },
        orderBy: { ocurridoEn: 'asc' },
      });
      expect(registrados.map((e) => [e.accion, e.antes, e.despues])).toEqual([
        ['auth.rol.desactivar', { activo: true }, { activo: false }],
        ['auth.rol.reactivar', { activo: false }, { activo: true }],
      ]);
      expect((await prisma.rol.findUniqueOrThrow({ where: { id: rolCarla } })).actualizadoPor).toBe(
        anaId,
      );
    });

    it('dos veces lo mismo: no registra de nuevo', async () => {
      await accion(tokenAna, rolCarla, 'desactivar');
      await accion(tokenAna, rolCarla, 'desactivar');
      await accion(tokenAna, rolCarla, 'reactivar');
      await accion(tokenAna, rolCarla, 'reactivar');
      expect(await prisma.eventoAuditoria.count({ where: { entidadId: rolCarla } })).toBe(2);
    });

    it('el Administrador: 422; uno de otra empresa: 404', async () => {
      for (const que of ['desactivar', 'reactivar'] as const) {
        const admin = await accion(tokenAna, administradorSur, que);
        expect([admin.status, admin.body.message]).toEqual([422, ADMINISTRADOR_FIJO]);
        expect((await accion(tokenAna, cajaZeta, que)).status).toBe(404);
      }
      expect((await prisma.rol.findUniqueOrThrow({ where: { id: cajaZeta } })).activo).toBe(true);
    });

    it('reactivar: quien no es administrador necesita todos sus permisos (6.7b)', async () => {
      // Carla tiene además el Consulta (para no perder el acceso al desactivar otros).
      await permisosDeCarla('auth.rol.desactivar', 'auth.usuario.ver');
      const caja = await prisma.rol.create({
        data: { empresaId: sur, nombre: 'Caja', activo: false },
      });
      const permiso = await prisma.permiso.findUniqueOrThrow({
        where: { codigo: 'auth.usuario.crear' },
      });
      await prisma.rolPermiso.create({ data: { rolId: caja.id, permisoId: permiso.id } });
      const tokenCarla = await entrar('carla');
      const negado = await accion(tokenCarla, caja.id, 'reactivar');
      expect([negado.status, negado.body.message]).toEqual([403, ESCALADA]);
      expect((await prisma.rol.findUniqueOrThrow({ where: { id: caja.id } })).activo).toBe(false);
      await prisma.rolPermiso.deleteMany({ where: { rolId: caja.id } });
      expect((await accion(tokenCarla, caja.id, 'reactivar')).status).toBe(200);
    });

    it('reactivar con un nombre que ya tomó otro activo: 409', async () => {
      await accion(tokenAna, rolCarla, 'desactivar');
      expect((await crearRol(tokenAna, { nombre: 'jefatura' })).status).toBe(201);
      const repetido = await accion(tokenAna, rolCarla, 'reactivar');
      expect([repetido.status, repetido.body.message]).toEqual([
        409,
        'Ya existe un rol con ese nombre',
      ]);
    });
  });
});
