import { Controller, Get } from '@nestjs/common';
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
import { RequierePermiso } from '../src/shared/infrastructure/http/acceso/acceso.decorators.js';
import { ok } from '../src/shared/infrastructure/http/respuesta-api.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd } from './utilidades/limpiar-bd.js';

const CONTRASENA = 'Margarita-Lunes-47';
const ORIGEN = 'http://localhost:4200';
/** Uno del catálogo real (`auth.permisos.ts`): la ruta de prueba lo pide. */
const PERMISO = 'auth.usuario.ver';
const SIN_PERMISO = 'No tiene permiso para esta acción';

/** Una ruta de un módulo cualquiera, protegida por un permiso. */
@Controller('prueba-permiso')
class PruebaPermisoController {
  @Get()
  @RequierePermiso(PERMISO)
  ver() {
    return ok(null, 'Con permiso');
  }
}

@Controller('prueba-permiso-inventado')
class PermisoInventadoController {
  @Get()
  @RequierePermiso('auth.usuario.borrar')
  ver() {
    return ok(null, 'Nunca');
  }
}

interface Respuesta {
  status: number;
  body: { success: boolean; data: unknown; message: string };
}

/** `@RequierePermiso()` con la base real (6.6b, QA-02): roles, empresas y Administrador. */
describe('Permiso de cada ruta (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sur: string;
  let zeta: string;
  let carlaId: string;

  beforeAll(async () => {
    app = await crearApp({ controllers: [PruebaPermisoController] });
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
    // limpiarBd() borra el catálogo: se vuelve a copiar como al arrancar.
    await app.get<SincronizarPermisosPort>(SINCRONIZAR_PERMISOS_PORT).execute();
    sur = await crearEmpresa('Comercial del Sur', 'ana');
    zeta = await crearEmpresa('Zeta Servicios', 'beto');
    // Carla no es administradora: en Sur, «Consulta» sin el permiso; en Zeta, «Caja» con él.
    const ana = await prisma.usuario.findUniqueOrThrow({ where: { nombreUsuario: 'ana' } });
    const carla = await prisma.usuario.create({
      data: {
        nombreUsuario: 'carla',
        nombreCompleto: 'Carla Vera',
        hashContrasena: ana.hashContrasena,
        ultimaEmpresaId: sur,
      },
    });
    carlaId = carla.id;
    await darRol(sur, 'Consulta', []);
    await darRol(zeta, 'Caja', [PERMISO]);
    await prisma.usuario.updateMany({ data: { debeCambiarContrasena: false } });
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

  /** Un rol de Carla en esa empresa, con esos permisos. */
  async function darRol(
    empresaId: string,
    nombre: string,
    codigos: string[],
    activo = true,
  ): Promise<void> {
    const rol = await prisma.rol.create({ data: { empresaId, nombre, activo } });
    await prisma.usuarioRol.create({ data: { usuarioId: carlaId, empresaId, rolId: rol.id } });
    const permisos = await prisma.permiso.findMany({ where: { codigo: { in: codigos } } });
    await prisma.rolPermiso.createMany({
      data: permisos.map((p) => ({ rolId: rol.id, permisoId: p.id })),
    });
  }

  async function entrar(nombreUsuario: string): Promise<string> {
    const respuesta = (await request(servidor())
      .post('/api/v1/auth/login')
      .send({ nombreUsuario, contrasena: CONTRASENA })) as Respuesta;
    expect(respuesta.status).toBe(200);
    return (respuesta.body.data as { tokenAcceso: string }).tokenAcceso;
  }

  const usarRuta = (token: string | null): Promise<Respuesta> => {
    const peticion = request(servidor()).get('/api/v1/prueba-permiso');
    if (token !== null) {
      peticion.set('Authorization', `Bearer ${token}`);
    }
    return peticion;
  };

  const esperar = (respuesta: Respuesta, estado: number, mensaje: string) => {
    expect(respuesta.status).toBe(estado);
    expect(respuesta.body).toEqual({ success: estado === 200, data: null, message: mensaje });
  };

  it('el Administrador pasa (sin filas de permisos, AUTH-D10)', async () => {
    esperar(await usarRuta(await entrar('ana')), 200, 'Con permiso');
  });

  it('sin el permiso en la empresa activa, 403; el de otra empresa no sirve', async () => {
    const token = await entrar('carla');
    esperar(await usarRuta(token), 403, SIN_PERMISO);

    // En Zeta su rol sí lo tiene: al pasar a Zeta, la misma ruta responde.
    const cambio = (await request(servidor())
      .post('/api/v1/auth/empresa')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGEN)
      .send({ empresaId: zeta })) as Respuesta;
    expect(cambio.status).toBe(200);
    esperar(await usarRuta(token), 200, 'Con permiso');
  });

  it('el permiso de un rol desactivado no cuenta', async () => {
    await darRol(sur, 'Viejo', [PERMISO], false);
    esperar(await usarRuta(await entrar('carla')), 403, SIN_PERMISO);
  });

  it('con el permiso marcado obsoleto, deja de contar', async () => {
    await darRol(sur, 'Caja Sur', [PERMISO]);
    const token = await entrar('carla');
    esperar(await usarRuta(token), 200, 'Con permiso');

    await prisma.permiso.update({ where: { codigo: PERMISO }, data: { obsoleto: true } });
    esperar(await usarRuta(token), 403, SIN_PERMISO);
  });

  it('el permiso se revisa en cada petición: quitarlo del rol corta enseguida', async () => {
    await darRol(sur, 'Caja Sur', [PERMISO]);
    const token = await entrar('carla');
    esperar(await usarRuta(token), 200, 'Con permiso');

    await prisma.rolPermiso.deleteMany({ where: { rol: { nombre: 'Caja Sur' } } });
    esperar(await usarRuta(token), 403, SIN_PERMISO);
  });

  it('primero la sesión: sin token, 401; con contraseña temporal, el 403 de AUTH-D14', async () => {
    esperar(await usarRuta(null), 401, 'Su sesión terminó. Vuelva a ingresar.');
    const token = await entrar('ana');
    await prisma.usuario.update({
      where: { nombreUsuario: 'ana' },
      data: { debeCambiarContrasena: true },
    });
    esperar(await usarRuta(token), 403, 'Debe cambiar su contraseña antes de continuar');
  });

  it('la API no arranca con un permiso fuera del catálogo (AUTH-D9)', async () => {
    await expect(crearApp({ controllers: [PermisoInventadoController] })).rejects.toThrow(
      'PermisoInventadoController.ver (permiso «auth.usuario.borrar» fuera del catálogo)',
    );
  });
});
