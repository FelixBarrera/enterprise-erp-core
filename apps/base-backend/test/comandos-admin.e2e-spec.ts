import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
  type CrearEmpresaConAdministradorPort,
} from '../src/modules/auth/application/ports/in/crear-empresa-con-administrador.port.js';
import {
  DESACTIVAR_EMPRESA_CON_SESIONES_PORT,
  type DesactivarEmpresaConSesionesPort,
} from '../src/modules/auth/application/ports/in/desactivar-empresa-con-sesiones.port.js';
import {
  CREAR_INSTALACION_INICIAL_PORT,
  type CrearInstalacionInicialPort,
} from '../src/modules/auth/application/ports/in/crear-instalacion-inicial.port.js';
import {
  HASHER_CONTRASENA_PORT,
  type HasherContrasenaPort,
} from '../src/modules/auth/application/ports/out/hasher-contrasena.port.js';
import {
  SESIONES_REPOSITORY_PORT,
  type SesionesRepositoryPort,
} from '../src/modules/auth/application/ports/out/sesiones.repository.port.js';
import { DesactivarEmpresaConSesionesUseCase } from '../src/modules/auth/application/use-cases/desactivar-empresa-con-sesiones.use-case.js';
import { Sesion } from '../src/modules/auth/domain/entities/sesion.entity.js';
import { ComandoCrearEmpresa } from '../src/modules/auth/infrastructure/adapters/in/cli/comando-crear-empresa.js';
import { ComandoCrearInicial } from '../src/modules/auth/infrastructure/adapters/in/cli/comando-crear-inicial.js';
import { ComandoDesactivarEmpresa } from '../src/modules/auth/infrastructure/adapters/in/cli/comando-desactivar-empresa.js';
import { ComandoRenombrarEmpresa } from '../src/modules/auth/infrastructure/adapters/in/cli/comando-renombrar-empresa.js';
import {
  SALIDA_ERROR,
  SALIDA_OK,
} from '../src/modules/auth/infrastructure/adapters/in/cli/comun.js';
import { TerminalDePrueba } from '../src/modules/auth/infrastructure/adapters/in/cli/terminal-de-prueba.js';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
} from '../src/modules/empresas/application/ports/in/consultar-empresas.port.js';
import {
  DESACTIVAR_EMPRESA_PORT,
  type DesactivarEmpresaPort,
} from '../src/modules/empresas/application/ports/in/desactivar-empresa.port.js';
import {
  RENOMBRAR_EMPRESA_PORT,
  type RenombrarEmpresaPort,
} from '../src/modules/empresas/application/ports/in/renombrar-empresa.port.js';
import { actorDelSistema } from '../src/shared/application/actor.js';
import { RELOJ_PORT } from '../src/shared/application/ports/reloj.port.js';
import { UNIDAD_DE_TRABAJO_PORT } from '../src/shared/application/ports/unidad-de-trabajo.port.js';
import { REGISTRAR_AUDITORIA_PORT } from '../src/modules/auditoria/application/ports/in/registrar-auditoria.port.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd, vaciarAuditoria } from './utilidades/limpiar-bd.js';

const CONTRASENA = 'Margarita-Lunes-47';
const DATOS_INICIALES = {
  EMPRESA_INICIAL_NOMBRE: 'Primera Empresa',
  ADMIN_INICIAL_USUARIO: 'Admin',
  ADMIN_INICIAL_NOMBRE: 'Administración General',
  ADMIN_INICIAL_CONTRASENA: CONTRASENA,
};

/** Los comandos `admin:*` contra la base real, con la terminal de prueba (e2e). */
describe('Comandos admin:* (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let hasher: HasherContrasenaPort;
  let inicial: () => ComandoCrearInicial;
  let crearEmpresa: (respuestas: string[]) => ComandoCrearEmpresa;
  let desactivar: (respuestas: string[]) => ComandoDesactivarEmpresa;
  let renombrar: (respuestas: string[]) => ComandoRenombrarEmpresa;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    hasher = app.get(HASHER_CONTRASENA_PORT);
    inicial = () =>
      new ComandoCrearInicial(
        app.get<CrearInstalacionInicialPort>(CREAR_INSTALACION_INICIAL_PORT),
        DATOS_INICIALES,
        new TerminalDePrueba(),
      );
    crearEmpresa = (respuestas) =>
      new ComandoCrearEmpresa(
        app.get<CrearEmpresaConAdministradorPort>(CREAR_EMPRESA_CON_ADMINISTRADOR_PORT),
        new TerminalDePrueba(respuestas),
      );
    desactivar = (respuestas) =>
      new ComandoDesactivarEmpresa(
        app.get<ConsultarEmpresasPort>(CONSULTAR_EMPRESAS_PORT),
        app.get<DesactivarEmpresaConSesionesPort>(DESACTIVAR_EMPRESA_CON_SESIONES_PORT),
        new TerminalDePrueba(respuestas),
      );
    renombrar = (respuestas) =>
      new ComandoRenombrarEmpresa(
        app.get<ConsultarEmpresasPort>(CONSULTAR_EMPRESAS_PORT),
        app.get<RenombrarEmpresaPort>(RENOMBRAR_EMPRESA_PORT),
        new TerminalDePrueba(respuestas),
      );
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('crear-inicial: empresa, rol Administrador y usuario con contraseña temporal, auditado', async () => {
    expect(await inicial().ejecutar()).toBe(SALIDA_OK);

    const empresa = await prisma.empresa.findFirstOrThrow();
    expect(empresa).toMatchObject({ nombre: 'Primera Empresa', activo: true, creadoPor: null });
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { nombreUsuario: 'admin' } });
    expect(usuario).toMatchObject({
      nombreCompleto: 'Administración General',
      debeCambiarContrasena: true,
      activo: true,
      creadoPor: null,
    });
    expect(usuario.hashContrasena).toMatch(/^\$argon2id\$/u);
    expect(await hasher.verificar(usuario.hashContrasena, CONTRASENA)).toBe(true);
    const rol = await prisma.rol.findFirstOrThrow({ where: { empresaId: empresa.id } });
    expect(rol).toMatchObject({ nombre: 'Administrador', esAdministrador: true, activo: true });
    expect(
      await prisma.usuarioRol.findMany({
        select: { usuarioId: true, empresaId: true, rolId: true },
      }),
    ).toEqual([{ usuarioId: usuario.id, empresaId: empresa.id, rolId: rol.id }]);

    const eventos = await prisma.eventoAuditoria.findMany({ orderBy: { id: 'asc' } });
    expect(eventos.map(({ accion }) => accion)).toEqual([
      'empresas.empresa.crear',
      'auth.rol.crear',
      'auth.usuario.crear',
    ]);
    expect(
      eventos.every(
        (e) =>
          e.empresaId === empresa.id &&
          e.usuarioId === null &&
          e.nombreUsuario === 'admin:crear-inicial',
      ),
    ).toBe(true);
    const enTexto = JSON.stringify(eventos);
    expect(enTexto).not.toContain(CONTRASENA);
    expect(enTexto).not.toContain(usuario.hashContrasena);
  });

  it('crear-inicial dos veces: la segunda no hace nada (OPS-03)', async () => {
    expect(await inicial().ejecutar()).toBe(SALIDA_OK);
    expect(await inicial().ejecutar()).toBe(SALIDA_OK);
    expect(await prisma.empresa.count()).toBe(1);
    expect(await prisma.usuario.count()).toBe(1);
    expect(await prisma.eventoAuditoria.count()).toBe(3);
  });

  it('crear-empresa con el administrador de otra empresa: un solo usuario, un rol en cada una', async () => {
    await inicial().ejecutar();
    expect(await crearEmpresa(['Segunda Empresa', 'admin', 's']).ejecutar()).toBe(SALIDA_OK);

    expect(await prisma.usuario.count()).toBe(1);
    const segunda = await prisma.empresa.findFirstOrThrow({ where: { nombre: 'Segunda Empresa' } });
    const asignaciones = await prisma.usuarioRol.findMany({ include: { rol: true } });
    expect(asignaciones).toHaveLength(2);
    expect(asignaciones.every(({ rol }) => rol.esAdministrador)).toBe(true);
    const ultimo = await prisma.eventoAuditoria.findFirstOrThrow({ orderBy: { id: 'desc' } });
    expect(ultimo).toMatchObject({ accion: 'auth.usuario.dar_acceso', empresaId: segunda.id });
  });

  it('crear-empresa con un usuario nuevo', async () => {
    const respuestas = ['Tercera', 'luis.mora', 'Luis Mora', CONTRASENA, CONTRASENA, 's'];
    expect(await crearEmpresa(respuestas).ejecutar()).toBe(SALIDA_OK);
    const luis = await prisma.usuario.findUniqueOrThrow({ where: { nombreUsuario: 'luis.mora' } });
    expect(luis.debeCambiarContrasena).toBe(true);
  });

  it('si algo falla a mitad (nombre de empresa repetido), no queda nada: ni usuario, ni rol, ni eventos', async () => {
    await inicial().ejecutar();
    const respuestas = ['PRIMERA empresa', 'nuevo.usuario', 'Nuevo', CONTRASENA, CONTRASENA, 's'];
    expect(await crearEmpresa(respuestas).ejecutar()).toBe(SALIDA_ERROR);
    expect(await prisma.usuario.count()).toBe(1);
    expect(await prisma.rol.count()).toBe(1);
    expect(await prisma.eventoAuditoria.count()).toBe(3);
  });

  it('desactivar-empresa: queda inactiva con su evento; sus roles y usuarios quedan', async () => {
    await inicial().ejecutar();
    expect(await desactivar(['1', 'primera empresa']).ejecutar()).toBe(SALIDA_OK);
    const empresa = await prisma.empresa.findFirstOrThrow();
    expect(empresa.activo).toBe(false);
    expect(await prisma.usuarioRol.count()).toBe(1);
    const ultimo = await prisma.eventoAuditoria.findFirstOrThrow({ orderBy: { id: 'desc' } });
    expect(ultimo).toMatchObject({
      accion: 'empresas.empresa.desactivar',
      empresaId: empresa.id,
      nombreUsuario: 'admin:desactivar-empresa',
    });
  });

  it('renombrar-empresa: nombre nuevo con su evento en esa empresa; otra vez igual no registra', async () => {
    await inicial().ejecutar();
    await vaciarAuditoria(prisma);
    expect(await renombrar(['1', 'Empresa Renombrada', 's']).ejecutar()).toBe(SALIDA_OK);
    const empresa = await prisma.empresa.findFirstOrThrow();
    expect(empresa).toMatchObject({
      nombre: 'Empresa Renombrada',
      activo: true,
      actualizadoPor: null,
    });
    const eventos = await prisma.eventoAuditoria.findMany();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      accion: 'empresas.empresa.editar',
      empresaId: empresa.id,
      usuarioId: null,
      nombreUsuario: 'admin:renombrar-empresa',
      entidadId: empresa.id,
      entidadNombre: 'Empresa Renombrada',
      antes: { nombre: 'Primera Empresa' },
      despues: { nombre: 'Empresa Renombrada' },
    });

    expect(await renombrar(['1', 'Empresa Renombrada', 's']).ejecutar()).toBe(SALIDA_OK);
    expect(await prisma.eventoAuditoria.count()).toBe(1);
  });

  it('renombrar-empresa: el nombre de otra activa (sin tildes ni mayúsculas) no se guarda', async () => {
    await inicial().ejecutar();
    expect(await crearEmpresa(['Café Ríos', 'admin', 's']).ejecutar()).toBe(SALIDA_OK);
    const antes = await prisma.empresa.findMany({ orderBy: { nombre: 'asc' } });
    expect(antes.map((e) => e.nombre)).toEqual(['Café Ríos', 'Primera Empresa']);
    expect(await renombrar(['2', 'CAFE RIOS', 's']).ejecutar()).toBe(SALIDA_ERROR);
    const despues = await prisma.empresa.findMany({ orderBy: { nombre: 'asc' } });
    expect(despues.map((e) => e.nombre)).toEqual(['Café Ríos', 'Primera Empresa']);
  });

  /** Una sesión abierta del usuario en la empresa (como la deja el login). */
  const abrirSesion = (usuarioId: string, empresaId: string): Promise<Sesion> => {
    const ahora = new Date();
    return app.get<SesionesRepositoryPort>(SESIONES_REPOSITORY_PORT).crear({
      usuarioId,
      empresaId,
      hashRefresh: 'a'.repeat(64),
      iniciadaEn: ahora,
      venceEn: Sesion.vencimiento(ahora, 13),
      ip: null,
      navegador: null,
    });
  };

  it('desactivar-empresa cierra las sesiones abiertas en ella, no las de otra empresa (6.5d)', async () => {
    await inicial().ejecutar();
    await crearEmpresa(['Segunda Empresa', 'admin', 's']).ejecutar();
    const [primera, segunda] = await prisma.empresa.findMany({ orderBy: { nombre: 'asc' } });
    const admin = await prisma.usuario.findFirstOrThrow();
    const enPrimera = await abrirSesion(admin.id, primera?.id ?? '');
    const enSegunda = await abrirSesion(admin.id, segunda?.id ?? '');

    expect(await desactivar(['1', 'primera empresa']).ejecutar()).toBe(SALIDA_OK);

    const porId = new Map((await prisma.sesion.findMany()).map((f) => [f.id, f]));
    expect(porId.get(enPrimera.id)?.motivoCierre).toBe('EMPRESA_DESACTIVADA');
    expect(porId.get(enSegunda.id)?.cerradaEn).toBeNull();
    const eventos = await prisma.eventoAuditoria.findMany({ orderBy: { id: 'desc' }, take: 2 });
    expect(eventos.map((e) => e.accion)).toEqual([
      'auth.sesion.cerrar',
      'empresas.empresa.desactivar',
    ]);
    expect(eventos[0]).toMatchObject({ empresaId: primera?.id, entidadId: primera?.id });
  });

  it('desactivar-empresa: si cerrar las sesiones falla, la empresa sigue activa (una sola transacción)', async () => {
    await inicial().ejecutar();
    const empresa = await prisma.empresa.findFirstOrThrow();
    const sesionesQueFallan = {
      cerrarTodasDeEmpresa: () => Promise.reject(new Error('falla a propósito')),
    } as unknown as SesionesRepositoryPort;
    const casoDeUso = new DesactivarEmpresaConSesionesUseCase(
      app.get<DesactivarEmpresaPort>(DESACTIVAR_EMPRESA_PORT),
      sesionesQueFallan,
      app.get(RELOJ_PORT),
      app.get(UNIDAD_DE_TRABAJO_PORT),
      app.get(REGISTRAR_AUDITORIA_PORT),
    );
    const eventosAntes = await prisma.eventoAuditoria.count();

    await expect(
      casoDeUso.desactivar(
        empresa.id,
        actorDelSistema({ nombreUsuario: 'admin:desactivar-empresa' }),
      ),
    ).rejects.toThrow('falla a propósito');

    expect((await prisma.empresa.findFirstOrThrow()).activo).toBe(true);
    expect(await prisma.eventoAuditoria.count()).toBe(eventosAntes);
  });
});
