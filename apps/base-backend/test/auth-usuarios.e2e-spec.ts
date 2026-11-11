import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  HASHER_CONTRASENA_PORT,
  type HasherContrasenaPort,
} from '../src/modules/auth/application/ports/out/hasher-contrasena.port.js';
import {
  ROLES_REPOSITORY_PORT,
  type RolesRepositoryPort,
} from '../src/modules/auth/application/ports/out/roles.repository.port.js';
import {
  USUARIOS_REPOSITORY_PORT,
  type UsuariosRepositoryPort,
} from '../src/modules/auth/application/ports/out/usuarios.repository.port.js';
import {
  NombreRolDuplicadoError,
  NombreUsuarioDuplicadoError,
} from '../src/modules/auth/domain/errors/auth.errors.js';
import { Contrasena } from '../src/modules/auth/domain/value-objects/contrasena.vo.js';
import { NombreCompleto } from '../src/modules/auth/domain/value-objects/nombre-completo.vo.js';
import { NombreRol } from '../src/modules/auth/domain/value-objects/nombre-rol.vo.js';
import { NombreUsuario } from '../src/modules/auth/domain/value-objects/nombre-usuario.vo.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../src/shared/application/ports/unidad-de-trabajo.port.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearApp } from './utilidades/crear-app.js';
import { limpiarBd } from './utilidades/limpiar-bd.js';

describe('Usuarios y roles (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let usuarios: UsuariosRepositoryPort;
  let roles: RolesRepositoryPort;
  let hasher: HasherContrasenaPort;
  let unidad: UnidadDeTrabajoPort;
  let empresaA: string;
  let empresaB: string;

  const nuevoUsuario = (nombre: string) => ({
    nombreUsuario: NombreUsuario.crear(nombre),
    nombreCompleto: NombreCompleto.crear(`Persona ${nombre}`),
    hashContrasena: '$argon2id$prueba',
    debeCambiarContrasena: true,
  });
  const nuevoRol = (empresaId: string, nombre: string, esAdministrador = false) => ({
    empresaId,
    nombre: NombreRol.crear(nombre),
    descripcion: null,
    esAdministrador,
  });
  /** El mensaje de PostgreSQL de un error de Prisma (el CHECK o el índice que saltó). */
  const fallaCon = async (promesa: Promise<unknown>, restriccion: string) => {
    await expect(promesa).rejects.toThrow();
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).toContain(restriccion);
  };

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    usuarios = app.get(USUARIOS_REPOSITORY_PORT);
    roles = app.get(ROLES_REPOSITORY_PORT);
    hasher = app.get(HASHER_CONTRASENA_PORT);
    unidad = app.get(UNIDAD_DE_TRABAJO_PORT);
  });

  beforeEach(async () => {
    await limpiarBd(prisma);
    empresaA = (await prisma.empresa.create({ data: { nombre: 'Empresa A' } })).id;
    empresaB = (await prisma.empresa.create({ data: { nombre: 'Empresa B' } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('usuarios', () => {
    it('crea con UUID v7, activo, sin fallos, y lo encuentra por id y por nombre', async () => {
      const creado = await usuarios.crear(nuevoUsuario('ana'), null);
      expect(creado.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/u);
      expect(creado.datos()).toMatchObject({
        nombreUsuario: 'ana',
        activo: true,
        intentosFallidos: 0,
        debeCambiarContrasena: true,
        bloqueadoHasta: null,
      });
      expect((await usuarios.buscarPorId(creado.id))?.datos()).toEqual(creado.datos());
      expect((await usuarios.buscarPorNombreUsuario(NombreUsuario.crear('ANA')))?.id).toBe(
        creado.id,
      );
      expect(await usuarios.buscarPorNombreUsuario(NombreUsuario.crear('otro'))).toBeNull();
    });

    it('el nombre de usuario nunca se reutiliza, aunque el anterior esté desactivado (AUTH-D3)', async () => {
      const ana = await usuarios.crear(nuevoUsuario('ana'), null);
      await usuarios.guardar(ana.desactivar(), null);
      await expect(usuarios.crear(nuevoUsuario('ana'), null)).rejects.toThrow(
        NombreUsuarioDuplicadoError,
      );
    });

    it('guarda los cambios (bloqueo, ingreso, contraseña) y quién los hizo', async () => {
      const ana = await usuarios.crear(nuevoUsuario('ana'), null);
      const ahora = new Date('2026-07-15T16:00:00Z');
      const cambiado = ana
        .registrarFallo(ahora)
        .usuario.ingresoExitoso(ahora, empresaA)
        .cambiarContrasena('$argon2id$otro', false);
      await usuarios.guardar(cambiado, ana.id);
      const fila = await prisma.usuario.findUniqueOrThrow({ where: { id: ana.id } });
      expect(fila).toMatchObject({
        ultimaEmpresaId: empresaA,
        ultimoIngresoEn: ahora,
        hashContrasena: '$argon2id$otro',
        debeCambiarContrasena: false,
        actualizadoPor: ana.id,
      });
    });

    it('la base rechaza un nombre de usuario con mayúsculas o espacios y los intentos negativos', async () => {
      const datos = { nombreCompleto: 'X', hashContrasena: 'h' };
      await fallaCon(
        prisma.usuario.create({ data: { ...datos, nombreUsuario: 'Ana' } }),
        'usuarios_nombre_usuario_formato_chk',
      );
      await fallaCon(
        prisma.usuario.create({ data: { ...datos, nombreUsuario: 'a b' } }),
        'usuarios_nombre_usuario_formato_chk',
      );
      await fallaCon(
        prisma.usuario.create({ data: { ...datos, nombreUsuario: 'ana', intentosFallidos: -1 } }),
        'usuarios_intentos_fallidos_chk',
      );
      await fallaCon(
        prisma.usuario.create({ data: { ...datos, nombreUsuario: 'ana', nombreCompleto: '  ' } }),
        'usuarios_nombre_completo_no_vacio_chk',
      );
    });

    it('con Argon2id: guarda el hash y lo verifica después', async () => {
      const contrasena = Contrasena.crear('tren azul 7', {
        nombreUsuario: 'ana',
        nombresEmpresas: ['Empresa A'],
        esComun: () => false,
      });
      const ana = await usuarios.crear(
        { ...nuevoUsuario('ana'), hashContrasena: await hasher.calcularHash(contrasena) },
        null,
      );
      const guardado = await usuarios.buscarPorId(ana.id);
      expect(await hasher.verificar(guardado?.hashContrasena ?? '', 'tren azul 7')).toBe(true);
    });
  });

  describe('roles', () => {
    it('nombre único entre los activos de la empresa, sin importar mayúsculas ni tildes', async () => {
      const caja = await roles.crear(nuevoRol(empresaA, 'Revisión'), null);
      await expect(roles.crear(nuevoRol(empresaA, 'REVISION'), null)).rejects.toThrow(
        NombreRolDuplicadoError,
      );
      // En otra empresa sí; y desactivado el primero, también en la misma.
      await roles.crear(nuevoRol(empresaB, 'Revisión'), null);
      await prisma.rol.update({ where: { id: caja.id }, data: { activo: false } });
      await roles.crear(nuevoRol(empresaA, 'revision'), null);
    });

    it('un solo Administrador por empresa, y no se puede desactivar', async () => {
      const administrador = await roles.crear(nuevoRol(empresaA, 'Administrador', true), null);
      expect((await roles.buscarAdministrador(empresaA))?.id).toBe(administrador.id);
      expect(await roles.buscarAdministrador(empresaB)).toBeNull();
      await fallaCon(
        roles.crear(nuevoRol(empresaA, 'Otro admin', true), null),
        'roles_administrador_key',
      );
      await fallaCon(
        prisma.rol.update({ where: { id: administrador.id }, data: { activo: false } }),
        'roles_administrador_activo_chk',
      );
    });

    it('la descripción se guarda como null, nunca como texto vacío', async () => {
      const rol = await roles.crear(nuevoRol(empresaA, 'Caja'), null);
      expect(
        (await prisma.rol.findUniqueOrThrow({ where: { id: rol.id } })).descripcion,
      ).toBeNull();
      await fallaCon(
        prisma.rol.create({ data: { empresaId: empresaA, nombre: 'X', descripcion: ' ' } }),
        'roles_descripcion_no_vacia_chk',
      );
    });
  });

  describe('usuarios_roles', () => {
    it('asignar dos veces no falla ni duplica (los comandos se pueden repetir)', async () => {
      const ana = await usuarios.crear(nuevoUsuario('ana'), null);
      const caja = await roles.crear(nuevoRol(empresaA, 'Caja'), null);
      expect(await roles.asignar(ana.id, caja, null)).toBe(true);
      expect(await roles.asignar(ana.id, caja, null)).toBe(false);
      expect(await prisma.usuarioRol.count()).toBe(1);
      expect((await prisma.usuarioRol.findFirstOrThrow()).empresaId).toBe(empresaA);
    });

    it('aislamiento: los roles de un usuario se ven solo en su empresa', async () => {
      const ana = await usuarios.crear(nuevoUsuario('ana'), null);
      const cajaA = await roles.crear(nuevoRol(empresaA, 'Caja'), null);
      const ventasA = await roles.crear(nuevoRol(empresaA, 'Ventas'), null);
      const cajaB = await roles.crear(nuevoRol(empresaB, 'Caja'), null);
      await roles.asignar(ana.id, ventasA, null);
      await roles.asignar(ana.id, cajaA, null);
      await roles.asignar(ana.id, cajaB, null);
      expect((await roles.rolesDeUsuario(ana.id, empresaA)).map((rol) => rol.id)).toEqual([
        cajaA.id,
        ventasA.id,
      ]);
      expect((await roles.rolesDeUsuario(ana.id, empresaB)).map((rol) => rol.id)).toEqual([
        cajaB.id,
      ]);
    });

    it('la FK compuesta impide un rol de B con la empresa A (EMP-D5)', async () => {
      const ana = await usuarios.crear(nuevoUsuario('ana'), null);
      const cajaB = await roles.crear(nuevoRol(empresaB, 'Caja'), null);
      await fallaCon(
        prisma.usuarioRol.create({
          data: { usuarioId: ana.id, empresaId: empresaA, rolId: cajaB.id },
        }),
        'usuarios_roles_empresa_id_rol_id_fkey',
      );
    });

    it('dentro de una transacción: si algo falla, no queda ni el usuario ni su rol', async () => {
      const caja = await roles.crear(nuevoRol(empresaA, 'Caja'), null);
      await expect(
        unidad.ejecutar(async () => {
          const ana = await usuarios.crear(nuevoUsuario('ana'), null);
          await roles.asignar(ana.id, caja, null);
          await usuarios.crear(nuevoUsuario('ana'), null);
        }),
      ).rejects.toThrow(NombreUsuarioDuplicadoError);
      expect(await prisma.usuario.count()).toBe(0);
      expect(await prisma.usuarioRol.count()).toBe(0);
    });
  });
});
