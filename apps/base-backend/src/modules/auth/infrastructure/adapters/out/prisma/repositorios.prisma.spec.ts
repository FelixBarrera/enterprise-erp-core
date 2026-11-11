import { Prisma } from '../../../../../../generated/prisma/client.js';
import type { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import {
  NombreRolDuplicadoError,
  NombreUsuarioDuplicadoError,
} from '../../../../domain/errors/auth.errors.js';
import { NombreCompleto } from '../../../../domain/value-objects/nombre-completo.vo.js';
import { NombreRol } from '../../../../domain/value-objects/nombre-rol.vo.js';
import { NombreUsuario } from '../../../../domain/value-objects/nombre-usuario.vo.js';
import { Rol } from '../../../../domain/entities/rol.entity.js';
import { PermisosPrismaRepository } from './permisos.prisma.repository.js';
import { RolesPrismaRepository } from './roles.prisma.repository.js';
import { UsuariosPrismaRepository } from './usuarios.prisma.repository.js';

const EMPRESA = '0190a4f2-1c2b-7000-8000-000000000009';

function conTx(tx: Record<string, unknown>): TransaccionPrisma {
  return { tx } as unknown as TransaccionPrisma;
}

function duplicado(indice: string) {
  return new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: '7',
    meta: { driverAdapterError: { cause: { constraint: { index: indice } } } },
  });
}

const nuevoUsuario = {
  nombreUsuario: NombreUsuario.crear('ana'),
  nombreCompleto: NombreCompleto.crear('Ana'),
  hashContrasena: 'h',
  debeCambiarContrasena: true,
};
const nuevoRol = {
  empresaId: EMPRESA,
  nombre: NombreRol.crear('Caja'),
  descripcion: null,
  esAdministrador: false,
};

describe('Repositorios de auth (sin base; con base en test/auth-usuarios.e2e-spec.ts)', () => {
  it('un id que no es UUID: no existe, sin consultar', async () => {
    const findUnique = vi.fn();
    const findFirst = vi.fn();
    const findMany = vi.fn();
    const usuarios = new UsuariosPrismaRepository(conTx({ usuario: { findUnique } }));
    const roles = new RolesPrismaRepository(conTx({ rol: { findFirst, findMany } }));
    expect(await usuarios.buscarPorId('abc')).toBeNull();
    expect(await roles.buscarAdministrador('abc')).toBeNull();
    expect(await roles.rolesDeUsuario('abc', EMPRESA)).toEqual([]);
    expect(await roles.rolesDeUsuario(EMPRESA, 'abc')).toEqual([]);
    expect(findUnique).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('el único del nombre de usuario se traduce a NombreUsuarioDuplicadoError', async () => {
    const usuarios = new UsuariosPrismaRepository(
      conTx({
        usuario: { create: vi.fn(() => Promise.reject(duplicado('usuarios_nombre_usuario_key'))) },
      }),
    );
    await expect(usuarios.crear(nuevoUsuario, null)).rejects.toThrow(NombreUsuarioDuplicadoError);
  });

  it('el único del nombre de rol se traduce a NombreRolDuplicadoError', async () => {
    const roles = new RolesPrismaRepository(
      conTx({
        rol: { create: vi.fn(() => Promise.reject(duplicado('roles_nombre_activos_key'))) },
      }),
    );
    await expect(roles.crear(nuevoRol, null)).rejects.toThrow(NombreRolDuplicadoError);
  });

  it('otro error sigue igual (un segundo Administrador es error de programación)', async () => {
    const otro = duplicado('roles_administrador_key');
    const roles = new RolesPrismaRepository(
      conTx({ rol: { create: vi.fn(() => Promise.reject(otro)) } }),
    );
    const usuarios = new UsuariosPrismaRepository(
      conTx({ usuario: { create: vi.fn(() => Promise.reject(otro)) } }),
    );
    await expect(roles.crear(nuevoRol, null)).rejects.toBe(otro);
    await expect(usuarios.crear(nuevoUsuario, null)).rejects.toBe(otro);
  });

  it('usuarios: lee, crea y guarda con las columnas y quién lo hizo (sin cambiar el nombre)', async () => {
    const fila = {
      id: EMPRESA,
      nombreUsuario: 'ana',
      nombreCompleto: 'Ana',
      hashContrasena: 'h',
      debeCambiarContrasena: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimaEmpresaId: null,
      ultimoIngresoEn: null,
      activo: true,
    };
    const findUnique = vi.fn().mockResolvedValueOnce(fila).mockResolvedValueOnce(null);
    const create = vi.fn().mockResolvedValue(fila);
    const update = vi.fn().mockResolvedValue(fila);
    const usuarios = new UsuariosPrismaRepository(
      conTx({ usuario: { findUnique, create, update } }),
    );
    expect((await usuarios.buscarPorId(EMPRESA))?.datos()).toEqual(fila);
    expect(await usuarios.buscarPorNombreUsuario(NombreUsuario.crear('ANA'))).toBeNull();
    expect(findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { nombreUsuario: 'ana' } }),
    );
    const creado = await usuarios.crear(nuevoUsuario, 'quien');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ creadoPor: 'quien', actualizadoPor: 'quien' }),
      }),
    );
    await usuarios.guardar(creado.desactivar(), 'quien');
    const [{ data }] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data).toMatchObject({ activo: false, actualizadoPor: 'quien' });
    expect(data).not.toHaveProperty('nombreUsuario');
    expect(data).not.toHaveProperty('id');
  });

  it('roles: lee, crea, asigna (dice si era nuevo) y lista por empresa', async () => {
    const fila = {
      id: EMPRESA,
      empresaId: EMPRESA,
      nombre: 'Caja',
      descripcion: null,
      esAdministrador: false,
      activo: true,
    };
    const findFirst = vi.fn().mockResolvedValueOnce(fila).mockResolvedValueOnce(null);
    const findMany = vi.fn().mockResolvedValue([fila]);
    const create = vi.fn().mockResolvedValue(fila);
    const createMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const roles = new RolesPrismaRepository(
      conTx({ rol: { findFirst, findMany, create }, usuarioRol: { createMany } }),
    );
    expect((await roles.buscarAdministrador(EMPRESA))?.datos()).toEqual(fila);
    expect(await roles.buscarAdministrador(EMPRESA)).toBeNull();
    const rol = await roles.crear(nuevoRol, null);
    expect(await roles.asignar(EMPRESA, rol, null)).toBe(true);
    expect(await roles.asignar(EMPRESA, rol, null)).toBe(false);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect((await roles.rolesDeUsuario(EMPRESA, EMPRESA)).map((r) => r.id)).toEqual([EMPRESA]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: EMPRESA, usuarios: { some: { usuarioId: EMPRESA } } },
      }),
    );
  });

  it('buscarParaActualizar bloquea la fila del usuario (FOR UPDATE) antes de leerla', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const findUnique = vi.fn().mockResolvedValue(null);
    const usuarios = new UsuariosPrismaRepository(
      conTx({ $queryRaw: queryRaw, usuario: { findUnique } }),
    );
    expect(await usuarios.buscarParaActualizar('abc')).toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(await usuarios.buscarParaActualizar(EMPRESA)).toBeNull();
    const [partes] = queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(partes.join('?')).toContain('FOR UPDATE');
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findUnique.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('empresasConAcceso: las empresas de sus roles activos, sin repetir', async () => {
    const findMany = vi.fn().mockResolvedValue([{ empresaId: EMPRESA }]);
    const roles = new RolesPrismaRepository(conTx({ usuarioRol: { findMany } }));
    expect(await roles.empresasConAcceso('abc')).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(await roles.empresasConAcceso(EMPRESA)).toEqual([EMPRESA]);
    expect(findMany).toHaveBeenCalledWith({
      where: { usuarioId: EMPRESA, rol: { activo: true } },
      select: { empresaId: true },
      distinct: ['empresaId'],
    });
  });

  describe('roles del 6.7b (con base en test/administracion-roles.e2e-spec.ts)', () => {
    const fila = {
      id: EMPRESA,
      empresaId: EMPRESA,
      nombre: 'Caja',
      descripcion: null,
      esAdministrador: false,
      activo: true,
    };

    it('un id o una empresa que no es UUID: no existe, sin consultar', async () => {
      const queryRaw = vi.fn();
      const findFirst = vi.fn();
      const count = vi.fn();
      const findMany = vi.fn();
      const roles = new RolesPrismaRepository(
        conTx({ $queryRaw: queryRaw, rol: { findFirst }, usuarioRol: { count } }),
      );
      const permisos = new PermisosPrismaRepository(conTx({ rolPermiso: { findMany } }));
      expect(await roles.buscarPorId('abc', EMPRESA)).toBeNull();
      expect(await roles.buscarPorId(EMPRESA, 'abc')).toBeNull();
      expect(await roles.buscarParaActualizar('abc', EMPRESA)).toBeNull();
      expect(await roles.listar('abc', {}, { pagina: 1, tamano: 20 })).toEqual({
        elementos: [],
        total: 0,
      });
      expect(await roles.contarUsuarios('abc')).toBe(0);
      expect(await permisos.codigosDeRol('abc')).toEqual([]);
      for (const simulado of [queryRaw, findFirst, count, findMany]) {
        expect(simulado).not.toHaveBeenCalled();
      }
    });

    it('buscarParaActualizar bloquea la fila del rol de esa empresa antes de leerla', async () => {
      const queryRaw = vi.fn().mockResolvedValue([]);
      const findFirst = vi.fn().mockResolvedValue(fila);
      const roles = new RolesPrismaRepository(conTx({ $queryRaw: queryRaw, rol: { findFirst } }));
      expect((await roles.buscarParaActualizar(EMPRESA, EMPRESA))?.datos()).toEqual(fila);
      const [partes] = queryRaw.mock.calls[0] as [TemplateStringsArray];
      expect(partes.join('?')).toContain('FOR UPDATE');
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: EMPRESA, empresaId: EMPRESA } }),
      );
    });

    it('guardar: el único del nombre se traduce; otro error sigue igual', async () => {
      const rol = Rol.reconstruir(fila);
      const otro = new Error('otro');
      const update = vi
        .fn()
        .mockResolvedValueOnce(fila)
        .mockRejectedValueOnce(duplicado('roles_nombre_activos_key'))
        .mockRejectedValueOnce(otro);
      const roles = new RolesPrismaRepository(conTx({ rol: { update } }));
      await roles.guardar(rol, 'quien');
      expect(update).toHaveBeenCalledWith({
        where: { id: EMPRESA },
        data: { nombre: 'Caja', descripcion: null, activo: true, actualizadoPor: 'quien' },
      });
      await expect(roles.guardar(rol, null)).rejects.toThrow(NombreRolDuplicadoError);
      await expect(roles.guardar(rol, null)).rejects.toBe(otro);
    });

    it('listar: sin filas, total 0', async () => {
      const queryRaw = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const roles = new RolesPrismaRepository(conTx({ $queryRaw: queryRaw }));
      expect(await roles.listar(EMPRESA, { texto: '  ' }, { pagina: 1, tamano: 5 })).toEqual({
        elementos: [],
        total: 0,
      });
    });
  });
  describe('usuarios del 6.7c (con base en test/administracion-usuarios.e2e-spec.ts)', () => {
    it('un id que no es UUID: no existe, sin consultar', async () => {
      const queryRaw = vi.fn();
      const findMany = vi.fn();
      const usuarios = new UsuariosPrismaRepository(conTx({ $queryRaw: queryRaw }));
      const roles = new RolesPrismaRepository(conTx({ usuarioRol: { findMany } }));
      const permisos = new PermisosPrismaRepository(conTx({ $queryRaw: queryRaw }));
      const pedido = { pagina: 1, tamano: 20 };
      const vacia = { elementos: [], total: 0 };
      expect(await usuarios.listarDeEmpresa('abc', {}, pedido)).toEqual(vacia);
      expect(await usuarios.listarDeEmpresa(EMPRESA, { rolId: 'abc' }, pedido)).toEqual(vacia);
      expect(await roles.empresasConRol('abc')).toEqual([]);
      expect(await permisos.empresasConPermiso('abc', 'auth.usuario.editar')).toEqual([]);
      expect(queryRaw).not.toHaveBeenCalled();
      expect(findMany).not.toHaveBeenCalled();
    });

    it('listarDeEmpresa: sin filas, total 0; con el texto y el rol en la consulta', async () => {
      const queryRaw = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const usuarios = new UsuariosPrismaRepository(conTx({ $queryRaw: queryRaw }));
      const filtros = { texto: ' 5%_ ', activo: true, rolId: EMPRESA };
      expect(await usuarios.listarDeEmpresa(EMPRESA, filtros, { pagina: 2, tamano: 5 })).toEqual({
        elementos: [],
        total: 0,
      });
      const valores = (queryRaw.mock.calls[0] as unknown[]).slice(1).flat(5);
      expect(JSON.stringify(valores)).toContain('%5\\\\%\\\\_%');
    });

    it('empresasConRol y empresasConPermiso: las empresas, sin repetir', async () => {
      const findMany = vi.fn().mockResolvedValue([{ empresaId: EMPRESA }]);
      const queryRaw = vi.fn().mockResolvedValue([{ empresaId: EMPRESA }]);
      const roles = new RolesPrismaRepository(conTx({ usuarioRol: { findMany } }));
      const permisos = new PermisosPrismaRepository(conTx({ $queryRaw: queryRaw }));
      expect(await roles.empresasConRol(EMPRESA)).toEqual([EMPRESA]);
      expect(findMany).toHaveBeenCalledWith({
        where: { usuarioId: EMPRESA },
        select: { empresaId: true },
        distinct: ['empresaId'],
      });
      expect(await permisos.empresasConPermiso(EMPRESA, 'auth.usuario.editar')).toEqual([EMPRESA]);
    });
  });
});
