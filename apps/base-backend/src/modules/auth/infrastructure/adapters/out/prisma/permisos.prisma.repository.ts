import { Injectable } from '@nestjs/common';
import { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import type { PermisosRepositoryPort } from '../../../../application/ports/out/permisos.repository.port.js';
import type {
  PermisoDeclarado,
  PermisoGuardado,
} from '../../../../domain/services/catalogo-permisos.js';
import { esUuid } from './es-uuid.js';

/**
 * Llave del bloqueo de la sincronización (`pg_advisory_xact_lock`): un número fijo cualquiera,
 * solo tiene que ser el mismo en todos los servidores. Se suelta sola al terminar la transacción.
 */
const LLAVE_BLOQUEO_CATALOGO = 6_060_001;

/** `seguridad.permisos` y `seguridad.roles_permisos`. */
@Injectable()
export class PermisosPrismaRepository implements PermisosRepositoryPort {
  constructor(private readonly txHost: TransaccionPrisma) {}

  async bloquearCatalogo(): Promise<void> {
    await this.txHost.tx
      .$executeRaw`SELECT pg_advisory_xact_lock(${LLAVE_BLOQUEO_CATALOGO}::bigint)`;
  }

  listar(): Promise<PermisoGuardado[]> {
    return this.txHost.tx.permiso.findMany({
      select: { id: true, codigo: true, descripcion: true, obsoleto: true },
      orderBy: { codigo: 'asc' },
    });
  }

  async crear(nuevos: readonly PermisoDeclarado[], ahora: Date): Promise<void> {
    await this.txHost.tx.permiso.createMany({
      data: nuevos.map((p) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        creadoEn: ahora,
        actualizadoEn: ahora,
      })),
    });
  }

  /** Una sola sentencia para todos (nada de consultas dentro de un bucle). */
  async actualizar(cambiados: readonly PermisoGuardado[], ahora: Date): Promise<void> {
    const ids = cambiados.map((p) => p.id);
    const descripciones = cambiados.map((p) => p.descripcion);
    const obsoletos = cambiados.map((p) => p.obsoleto);
    await this.txHost.tx.$executeRaw`
      UPDATE seguridad.permisos p
      SET descripcion = v.descripcion, obsoleto = v.obsoleto, actualizado_en = ${ahora}
      FROM unnest(${ids}::uuid[], ${descripciones}::text[], ${obsoletos}::boolean[])
           AS v(id, descripcion, obsoleto)
      WHERE p.id = v.id`;
  }

  async codigosVigentes(): Promise<string[]> {
    const filas = await this.txHost.tx.permiso.findMany({
      where: { obsoleto: false },
      select: { codigo: true },
      orderBy: { codigo: 'asc' },
    });
    return filas.map((f) => f.codigo);
  }

  async codigosDeUsuario(usuarioId: string, empresaId: string): Promise<string[]> {
    if (!esUuid(usuarioId) || !esUuid(empresaId)) {
      return [];
    }
    const filas = await this.txHost.tx.$queryRaw<{ codigo: string }[]>`
      SELECT DISTINCT p.codigo
      FROM seguridad.usuarios_roles ur
      JOIN seguridad.roles r ON r.id = ur.rol_id AND r.activo
      JOIN seguridad.roles_permisos rp ON rp.rol_id = r.id
      JOIN seguridad.permisos p ON p.id = rp.permiso_id AND NOT p.obsoleto
      WHERE ur.usuario_id = ${usuarioId}::uuid AND ur.empresa_id = ${empresaId}::uuid
      ORDER BY p.codigo`;
    return filas.map((f) => f.codigo);
  }

  async empresasConPermiso(usuarioId: string, codigo: string): Promise<string[]> {
    if (!esUuid(usuarioId)) {
      return [];
    }
    const filas = await this.txHost.tx.$queryRaw<{ empresaId: string }[]>`
      SELECT DISTINCT ur.empresa_id AS "empresaId"
      FROM seguridad.usuarios_roles ur
      JOIN seguridad.roles r ON r.id = ur.rol_id AND r.activo
      WHERE ur.usuario_id = ${usuarioId}::uuid
        AND (r.es_administrador OR EXISTS (
          SELECT 1
          FROM seguridad.roles_permisos rp
          JOIN seguridad.permisos p ON p.id = rp.permiso_id AND NOT p.obsoleto
          WHERE rp.rol_id = r.id AND p.codigo = ${codigo}))`;
    return filas.map((f) => f.empresaId);
  }

  async codigosDeRol(rolId: string): Promise<string[]> {
    if (!esUuid(rolId)) {
      return [];
    }
    const filas = await this.txHost.tx.rolPermiso.findMany({
      where: { rolId, permiso: { obsoleto: false } },
      select: { permiso: { select: { codigo: true } } },
      orderBy: { permiso: { codigo: 'asc' } },
    });
    return filas.map((f) => f.permiso.codigo);
  }

  async codigosDeRoles(rolIds: readonly string[]): Promise<Map<string, string[]>> {
    const resultado = new Map<string, string[]>(rolIds.map((id) => [id, []]));
    const validos = rolIds.filter(esUuid);
    if (validos.length === 0) {
      return resultado;
    }
    const filas = await this.txHost.tx.rolPermiso.findMany({
      where: { rolId: { in: validos }, permiso: { obsoleto: false } },
      select: { rolId: true, permiso: { select: { codigo: true } } },
      orderBy: { permiso: { codigo: 'asc' } },
    });
    for (const fila of filas) {
      resultado.get(fila.rolId)?.push(fila.permiso.codigo);
    }
    return resultado;
  }

  /** Dos sentencias, sin importar cuántos sean: quitar los que sobran y agregar los que faltan. */
  async fijarDeRol(
    rolId: string,
    codigos: readonly string[],
    creadoPor: string | null,
  ): Promise<void> {
    const lista = [...codigos];
    await this.txHost.tx.$executeRaw`
      DELETE FROM seguridad.roles_permisos rp
      USING seguridad.permisos p
      WHERE rp.rol_id = ${rolId}::uuid AND p.id = rp.permiso_id
        AND NOT (p.codigo = ANY(${lista}::text[]))`;
    await this.txHost.tx.$executeRaw`
      INSERT INTO seguridad.roles_permisos (rol_id, permiso_id, creado_por)
      SELECT ${rolId}::uuid, p.id, ${creadoPor}::uuid
      FROM seguridad.permisos p
      WHERE p.codigo = ANY(${lista}::text[]) AND NOT p.obsoleto
      ON CONFLICT (rol_id, permiso_id) DO NOTHING`;
  }
}
