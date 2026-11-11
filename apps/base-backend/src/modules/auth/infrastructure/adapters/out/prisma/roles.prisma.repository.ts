import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../../generated/prisma/client.js';
import { desplazamiento, type PedidoPagina } from '../../../../../../shared/application/pagina.js';
import { indiceUnicoViolado } from '../../../../../../shared/infrastructure/prisma/errores-prisma.js';
import { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import type {
  FiltrosRoles,
  NuevoRol,
  RolesRepositoryPort,
  RolResumenGuardado,
} from '../../../../application/ports/out/roles.repository.port.js';
import { type DatosRol, Rol } from '../../../../domain/entities/rol.entity.js';
import { NombreRolDuplicadoError } from '../../../../domain/errors/auth.errors.js';
import { esUuid } from './es-uuid.js';

/** Índice único parcial escrito a mano en la migración crear_usuarios_roles. */
const INDICE_NOMBRE_ACTIVOS = 'roles_nombre_activos_key';
const COLUMNAS = {
  id: true,
  empresaId: true,
  nombre: true,
  descripcion: true,
  esAdministrador: true,
  activo: true,
} as const;

/** `seguridad.roles` y `seguridad.usuarios_roles`, siempre filtrando por empresa. */
@Injectable()
export class RolesPrismaRepository implements RolesRepositoryPort {
  constructor(private readonly txHost: TransaccionPrisma) {}

  async buscarAdministrador(empresaId: string): Promise<Rol | null> {
    if (!esUuid(empresaId)) {
      return null;
    }
    const fila = await this.txHost.tx.rol.findFirst({
      where: { empresaId, esAdministrador: true },
      select: COLUMNAS,
    });
    return fila === null ? null : Rol.reconstruir(fila);
  }

  async crear(nuevo: NuevoRol, creadoPor: string | null): Promise<Rol> {
    try {
      const fila = await this.txHost.tx.rol.create({
        data: {
          empresaId: nuevo.empresaId,
          nombre: nuevo.nombre.valor,
          descripcion: nuevo.descripcion,
          esAdministrador: nuevo.esAdministrador,
          creadoPor,
          actualizadoPor: creadoPor,
        },
        select: COLUMNAS,
      });
      return Rol.reconstruir(fila);
    } catch (error) {
      throw indiceUnicoViolado(error, INDICE_NOMBRE_ACTIVOS)
        ? new NombreRolDuplicadoError()
        : error;
    }
  }

  async asignar(usuarioId: string, rol: Rol, creadoPor: string | null): Promise<boolean> {
    // skipDuplicates: si ya lo tenía, no falla ni cambia nada (ON CONFLICT DO NOTHING).
    const { count } = await this.txHost.tx.usuarioRol.createMany({
      data: [{ usuarioId, empresaId: rol.empresaId, rolId: rol.id, creadoPor }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  async rolesDeUsuario(usuarioId: string, empresaId: string): Promise<Rol[]> {
    if (!esUuid(usuarioId) || !esUuid(empresaId)) {
      return [];
    }
    const filas = await this.txHost.tx.rol.findMany({
      where: { empresaId, usuarios: { some: { usuarioId } } },
      select: COLUMNAS,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
    return filas.map((fila) => Rol.reconstruir(fila));
  }

  async empresasConAcceso(usuarioId: string): Promise<string[]> {
    if (!esUuid(usuarioId)) {
      return [];
    }
    const filas = await this.txHost.tx.usuarioRol.findMany({
      where: { usuarioId, rol: { activo: true } },
      select: { empresaId: true },
      distinct: ['empresaId'],
    });
    return filas.map((fila) => fila.empresaId);
  }

  async empresasConRol(usuarioId: string): Promise<string[]> {
    if (!esUuid(usuarioId)) {
      return [];
    }
    const filas = await this.txHost.tx.usuarioRol.findMany({
      where: { usuarioId },
      select: { empresaId: true },
      distinct: ['empresaId'],
    });
    return filas.map((fila) => fila.empresaId);
  }

  buscarPorId(id: string, empresaId: string): Promise<Rol | null> {
    return this.buscar(id, empresaId);
  }

  async buscarParaActualizar(id: string, empresaId: string): Promise<Rol | null> {
    if (!esUuid(id) || !esUuid(empresaId)) {
      return null;
    }
    await this.txHost.tx.$queryRaw`
      SELECT 1 FROM seguridad.roles
      WHERE id = ${id}::uuid AND empresa_id = ${empresaId}::uuid
      FOR UPDATE`;
    return this.buscar(id, empresaId);
  }

  async guardar(rol: Rol, actualizadoPor: string | null): Promise<void> {
    try {
      await this.txHost.tx.rol.update({
        where: { id: rol.id },
        data: {
          nombre: rol.nombre.valor,
          descripcion: rol.descripcion,
          activo: rol.activo,
          actualizadoPor,
        },
      });
    } catch (error) {
      throw indiceUnicoViolado(error, INDICE_NOMBRE_ACTIVOS)
        ? new NombreRolDuplicadoError()
        : error;
    }
  }

  /**
   * SQL a mano: el filtro y el orden van sin mayúsculas ni tildes (`nombre_normalizado()`), y
   * las dos cuentas salen en la misma consulta (nada de una consulta por fila). Los roles de una
   * empresa son pocos: alcanza con el índice `roles_empresa_id_id_key`, que empieza por la
   * empresa.
   */
  async listar(
    empresaId: string,
    filtros: FiltrosRoles,
    pedido: PedidoPagina,
  ): Promise<{ elementos: RolResumenGuardado[]; total: number }> {
    if (!esUuid(empresaId)) {
      return { elementos: [], total: 0 };
    }
    const condiciones = [Prisma.sql`r.empresa_id = ${empresaId}::uuid`];
    if (filtros.activo !== undefined) {
      condiciones.push(Prisma.sql`r.activo = ${filtros.activo}`);
    }
    const texto = filtros.texto?.trim() ?? '';
    if (texto !== '') {
      const patron = `%${texto.replace(/[\\%_]/gu, '\\$&')}%`;
      condiciones.push(
        Prisma.sql`public.nombre_normalizado(r.nombre) LIKE public.nombre_normalizado(${patron})`,
      );
    }
    const donde = Prisma.join(condiciones, ' AND ');
    const [elementos, cuenta] = await Promise.all([
      this.txHost.tx.$queryRaw<RolResumenGuardado[]>`
        SELECT r.id, r.empresa_id AS "empresaId", r.nombre, r.descripcion,
               r.es_administrador AS "esAdministrador", r.activo,
               (SELECT count(*)::int
                  FROM seguridad.roles_permisos rp
                  JOIN seguridad.permisos p ON p.id = rp.permiso_id AND NOT p.obsoleto
                 WHERE rp.rol_id = r.id) AS "cantidadPermisos",
               (SELECT count(*)::int
                  FROM seguridad.usuarios_roles ur
                  JOIN seguridad.usuarios u ON u.id = ur.usuario_id AND u.activo
                 WHERE ur.rol_id = r.id) AS "cantidadUsuarios"
        FROM seguridad.roles r
        WHERE ${donde}
        ORDER BY r.es_administrador DESC, public.nombre_normalizado(r.nombre), r.id
        LIMIT ${pedido.tamano} OFFSET ${desplazamiento(pedido)}`,
      this.txHost.tx.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS total FROM seguridad.roles r WHERE ${donde}`,
    ]);
    return { elementos, total: cuenta[0]?.total ?? 0 };
  }

  contarUsuarios(rolId: string): Promise<number> {
    if (!esUuid(rolId)) {
      return Promise.resolve(0);
    }
    return this.txHost.tx.usuarioRol.count({ where: { rolId, usuario: { activo: true } } });
  }

  /** SQL a mano por el orden sin mayúsculas ni tildes (`nombre_normalizado()`), como `listar()`. */
  async activosDeEmpresa(empresaId: string): Promise<Rol[]> {
    if (!esUuid(empresaId)) {
      return [];
    }
    const filas = await this.txHost.tx.$queryRaw<DatosRol[]>`
      SELECT r.id, r.empresa_id AS "empresaId", r.nombre, r.descripcion,
             r.es_administrador AS "esAdministrador", r.activo
      FROM seguridad.roles r
      WHERE r.empresa_id = ${empresaId}::uuid AND r.activo
      ORDER BY r.es_administrador DESC, public.nombre_normalizado(r.nombre), r.id`;
    return filas.map((fila) => Rol.reconstruir(fila));
  }

  async buscarVarios(ids: readonly string[], empresaId: string): Promise<Rol[]> {
    const validos = [...new Set(ids)].filter(esUuid);
    if (validos.length === 0 || !esUuid(empresaId)) {
      return [];
    }
    const filas = await this.txHost.tx.rol.findMany({
      where: { id: { in: validos }, empresaId },
      select: COLUMNAS,
    });
    return filas.map((fila) => Rol.reconstruir(fila));
  }

  /**
   * Dos sentencias, sin importar cuántos sean: quitar los que sobran (solo en esa empresa) y
   * agregar los que faltan. La FK compuesta `(empresa_id, rol_id)` impide un rol de otra empresa.
   */
  async fijarDeUsuario(
    usuarioId: string,
    empresaId: string,
    rolIds: readonly string[],
    creadoPor: string | null,
  ): Promise<void> {
    await this.txHost.tx.usuarioRol.deleteMany({
      where: { usuarioId, empresaId, rolId: { notIn: [...rolIds] } },
    });
    if (rolIds.length > 0) {
      await this.txHost.tx.usuarioRol.createMany({
        data: rolIds.map((rolId) => ({ usuarioId, empresaId, rolId, creadoPor })),
        skipDuplicates: true,
      });
    }
  }

  private async buscar(id: string, empresaId: string): Promise<Rol | null> {
    if (!esUuid(id) || !esUuid(empresaId)) {
      return null;
    }
    const fila = await this.txHost.tx.rol.findFirst({
      where: { id, empresaId },
      select: COLUMNAS,
    });
    return fila === null ? null : Rol.reconstruir(fila);
  }
}
