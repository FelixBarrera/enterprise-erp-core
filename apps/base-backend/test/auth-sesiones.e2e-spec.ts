import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
  type CrearEmpresaConAdministradorPort,
} from '../src/modules/auth/application/ports/in/crear-empresa-con-administrador.port.js';
import {
  GENERADOR_TOKENS_PORT,
  type GeneradorTokensPort,
} from '../src/modules/auth/application/ports/out/generador-tokens.port.js';
import {
  ROLES_REPOSITORY_PORT,
  type RolesRepositoryPort,
} from '../src/modules/auth/application/ports/out/roles.repository.port.js';
import {
  SESIONES_REPOSITORY_PORT,
  type NuevaSesion,
  type SesionesRepositoryPort,
} from '../src/modules/auth/application/ports/out/sesiones.repository.port.js';
import {
  USUARIOS_REPOSITORY_PORT,
  type UsuariosRepositoryPort,
} from '../src/modules/auth/application/ports/out/usuarios.repository.port.js';
import { MotivoCierreSesion, Sesion } from '../src/modules/auth/domain/entities/sesion.entity.js';
import { NombreCompleto } from '../src/modules/auth/domain/value-objects/nombre-completo.vo.js';
import { NombreUsuario } from '../src/modules/auth/domain/value-objects/nombre-usuario.vo.js';
import { actorDelSistema } from '../src/shared/application/actor.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../src/shared/application/ports/unidad-de-trabajo.port.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd } from './utilidades/limpiar-bd.js';

const INICIO = new Date('2026-07-15T13:00:00Z');
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

/** `seguridad.sesiones`, su repositorio y los tokens, contra la base real. */
describe('Sesiones (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sesiones: SesionesRepositoryPort;
  let usuarios: UsuariosRepositoryPort;
  let roles: RolesRepositoryPort;
  let unidad: UnidadDeTrabajoPort;
  let empresaId: string;
  let usuarioId: string;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    sesiones = app.get(SESIONES_REPOSITORY_PORT);
    usuarios = app.get(USUARIOS_REPOSITORY_PORT);
    roles = app.get(ROLES_REPOSITORY_PORT);
    unidad = app.get(UNIDAD_DE_TRABAJO_PORT);
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
    const creada = await app
      .get<CrearEmpresaConAdministradorPort>(CREAR_EMPRESA_CON_ADMINISTRADOR_PORT)
      .crear(
        {
          nombreEmpresa: 'Comercial del Sur',
          administrador: {
            tipo: 'nuevo',
            nombreUsuario: 'ana',
            nombreCompleto: 'Ana Pérez',
            contrasena: 'Margarita-Lunes-47',
          },
        },
        actorDelSistema({ nombreUsuario: 'admin:crear-empresa' }),
      );
    empresaId = creada.empresa.id;
    usuarioId = creada.administrador.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const nueva = (cambios: Partial<NuevaSesion> = {}): NuevaSesion => ({
    usuarioId,
    empresaId,
    hashRefresh: HASH_A,
    iniciadaEn: INICIO,
    venceEn: Sesion.vencimiento(INICIO, 13),
    ip: '10.0.0.7',
    navegador: 'Chrome',
    ...cambios,
  });

  it('crea la sesión abierta, con id UUID v7, y la lee de vuelta', async () => {
    const creada = await sesiones.crear(nueva({ ip: '', navegador: null }));

    expect(creada.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    expect(creada.datos()).toMatchObject({
      ultimoUsoEn: INICIO,
      venceEn: new Date('2026-07-16T02:00:00Z'),
      cerradaEn: null,
      motivoCierre: null,
      hashRefreshAnterior: null,
      ip: null,
      navegador: null,
    });
    expect((await sesiones.buscarParaActualizar(creada.id))?.datos()).toEqual(creada.datos());
    expect(await sesiones.buscarParaActualizar('0190a4f2-1c2b-7000-8000-000000000999')).toBeNull();
    expect(await sesiones.buscarParaActualizar('no-es-uuid')).toBeNull();
  });

  it('guarda la rotación y el cierre (el enum queda con su nombre)', async () => {
    const creada = await sesiones.crear(nueva());
    const rotadaEn = new Date('2026-07-15T13:14:00Z');

    await sesiones.guardar(creada.rotar(HASH_B, rotadaEn).cerrar('SALIDA', rotadaEn));

    const fila = await prisma.sesion.findUniqueOrThrow({ where: { id: creada.id } });
    expect(fila).toMatchObject({
      hashRefresh: HASH_B,
      hashRefreshAnterior: HASH_A,
      rotadoEn: rotadaEn,
      ultimoUsoEn: rotadaEn,
      cerradaEn: rotadaEn,
      motivoCierre: 'SALIDA',
    });
  });

  it('cerrarTodasDelUsuario cierra solo las abiertas de ese usuario', async () => {
    const abierta = await sesiones.crear(nueva());
    const yaCerrada = await sesiones.crear(nueva());
    await sesiones.guardar(yaCerrada.cerrar('SALIDA', INICIO));
    const otro = await usuarios.crear(
      {
        nombreUsuario: NombreUsuario.crear('luis'),
        nombreCompleto: NombreCompleto.crear('Luis'),
        hashContrasena: 'h',
        debeCambiarContrasena: false,
      },
      null,
    );
    const deOtro = await sesiones.crear(nueva({ usuarioId: otro.id }));
    const ahora = new Date('2026-07-15T14:00:00Z');

    expect(await sesiones.cerrarTodasDelUsuario(usuarioId, MotivoCierreSesion.REUSO, ahora)).toBe(
      1,
    );

    const filas = await prisma.sesion.findMany();
    const porId = new Map(filas.map((f) => [f.id, f]));
    expect(porId.get(abierta.id)).toMatchObject({ cerradaEn: ahora, motivoCierre: 'REUSO' });
    expect(porId.get(yaCerrada.id)).toMatchObject({ cerradaEn: INICIO, motivoCierre: 'SALIDA' });
    expect(porId.get(deOtro.id)).toMatchObject({ cerradaEn: null });
  });

  it('cerrarOtrasDelUsuario deja abierta la que se indica y cierra las demás del usuario', async () => {
    const esta = await sesiones.crear(nueva());
    const otra = await sesiones.crear(nueva());
    const yaCerrada = await sesiones.crear(nueva());
    await sesiones.guardar(yaCerrada.cerrar('SALIDA', INICIO));
    const ahora = new Date('2026-07-15T14:00:00Z');

    expect(
      await sesiones.cerrarOtrasDelUsuario(
        usuarioId,
        esta.id,
        MotivoCierreSesion.CAMBIO_CONTRASENA,
        ahora,
      ),
    ).toBe(1);

    const porId = new Map((await prisma.sesion.findMany()).map((f) => [f.id, f]));
    expect(porId.get(esta.id)).toMatchObject({ cerradaEn: null, motivoCierre: null });
    expect(porId.get(otra.id)).toMatchObject({
      cerradaEn: ahora,
      motivoCierre: 'CAMBIO_CONTRASENA',
    });
    expect(porId.get(yaCerrada.id)).toMatchObject({ motivoCierre: 'SALIDA' });
  });

  it('cerrarTodasDeEmpresa cierra las abiertas de esa empresa, de cualquier usuario', async () => {
    const otraEmpresa = await app
      .get<CrearEmpresaConAdministradorPort>(CREAR_EMPRESA_CON_ADMINISTRADOR_PORT)
      .crear(
        {
          nombreEmpresa: 'Industrias del Norte',
          administrador: {
            tipo: 'nuevo',
            nombreUsuario: 'beto',
            nombreCompleto: 'Beto Ruiz',
            contrasena: 'Margarita-Lunes-47',
          },
        },
        actorDelSistema({ nombreUsuario: 'admin:crear-empresa' }),
      );
    const deAna = await sesiones.crear(nueva());
    const deBeto = await sesiones.crear(nueva({ usuarioId: otraEmpresa.administrador.id }));
    const deBetoAqui = await sesiones.crear(
      nueva({ usuarioId: otraEmpresa.administrador.id, empresaId: otraEmpresa.empresa.id }),
    );
    const ahora = new Date('2026-07-15T14:00:00Z');

    expect(
      await sesiones.cerrarTodasDeEmpresa(empresaId, MotivoCierreSesion.EMPRESA_DESACTIVADA, ahora),
    ).toBe(2);
    expect(
      await sesiones.cerrarTodasDeEmpresa('abc', MotivoCierreSesion.EMPRESA_DESACTIVADA, ahora),
    ).toBe(0);

    const porId = new Map((await prisma.sesion.findMany()).map((f) => [f.id, f]));
    expect(porId.get(deAna.id)).toMatchObject({ motivoCierre: 'EMPRESA_DESACTIVADA' });
    expect(porId.get(deBeto.id)).toMatchObject({ motivoCierre: 'EMPRESA_DESACTIVADA' });
    expect(porId.get(deBetoAqui.id)).toMatchObject({ cerradaEn: null });
  });

  it('buscarParaActualizar bloquea la fila: otra transacción espera y ve lo que guardó la primera', async () => {
    const creada = await sesiones.crear(nueva());
    const orden: string[] = [];

    const primera = unidad.ejecutar(async () => {
      const sesion = await sesiones.buscarParaActualizar(creada.id);
      orden.push('primera leyó');
      await new Promise((listo) => setTimeout(listo, 300));
      await sesiones.guardar(sesion?.rotar(HASH_B, INICIO) ?? creada);
      orden.push('primera guardó');
    });
    await new Promise((listo) => setTimeout(listo, 50));
    const segunda = unidad.ejecutar(async () => {
      const sesion = await sesiones.buscarParaActualizar(creada.id);
      orden.push('segunda leyó');
      return sesion?.datos().hashRefresh;
    });

    const [, visto] = await Promise.all([primera, segunda]);
    expect(orden).toEqual(['primera leyó', 'primera guardó', 'segunda leyó']);
    expect(visto).toBe(HASH_B);
  });

  it('usuarios.buscarParaActualizar y roles.empresasConAcceso contra la base', async () => {
    expect((await usuarios.buscarParaActualizar(usuarioId))?.nombreUsuario.valor).toBe('ana');
    expect(await usuarios.buscarParaActualizar('0190a4f2-1c2b-7000-8000-000000000999')).toBeNull();
    expect(await roles.empresasConAcceso(usuarioId)).toEqual([empresaId]);
    expect(await roles.empresasConAcceso('0190a4f2-1c2b-7000-8000-000000000999')).toEqual([]);
  });

  describe('la base rechaza lo que no cuadra (CHECK escritos a mano)', () => {
    const insertar = (columnas: Record<string, unknown>) =>
      prisma.sesion.create({
        data: {
          usuarioId,
          empresaId,
          hashRefresh: HASH_A,
          iniciadaEn: INICIO,
          venceEn: new Date('2026-07-16T02:00:00Z'),
          ultimoUsoEn: INICIO,
          ...columnas,
        },
      });

    it.each([
      [
        'un hash que no es SHA-256 en hex (un secreto en claro)',
        { hashRefresh: 'X'.repeat(64) },
        'sesiones_hash_formato_chk',
      ],
      ['cerrada sin motivo', { cerradaEn: INICIO }, 'sesiones_cierre_con_motivo_chk'],
      ['motivo sin cerrar', { motivoCierre: 'SALIDA' }, 'sesiones_cierre_con_motivo_chk'],
      ['vence antes de empezar', { venceEn: INICIO }, 'sesiones_fechas_chk'],
      [
        'hash anterior sin la hora de rotación',
        { hashRefreshAnterior: HASH_B },
        'sesiones_rotacion_chk',
      ],
      ['IP vacía', { ip: '' }, 'sesiones_ip_navegador_no_vacios_chk'],
    ])('%s', async (_caso, columnas, restriccion) => {
      await expect(insertar(columnas)).rejects.toThrow(restriccion);
    });
  });

  it('el generador de la app firma con JWT_SECRETO y verifica su propio token', async () => {
    const tokens = app.get<GeneradorTokensPort>(GENERADOR_TOKENS_PORT);
    const datos = { usuarioId, sesionId: '0190a4f2-1c2b-7000-8000-000000000301' };
    const { token } = await tokens.firmarAcceso(datos);
    expect(await tokens.verificarAcceso(token)).toEqual(datos);
    expect(tokens.huella(tokens.nuevoSecreto())).toMatch(/^[0-9a-f]{64}$/);
    const partes = { sesionId: datos.sesionId, secreto: tokens.nuevoSecreto() };
    expect(tokens.abrirRefresco(tokens.armarRefresco(partes))).toEqual(partes);
  });
});
