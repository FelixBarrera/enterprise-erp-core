import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../../generated/prisma/client.js';
import { desplazamiento, type PedidoPagina } from '../../../../../../shared/application/pagina.js';
import { indiceUnicoViolado } from '../../../../../../shared/infrastructure/prisma/errores-prisma.js';
import { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import type {
  FiltrosUsuarios,
  NuevoUsuario,
  UsuarioResumenGuardado,
  UsuariosRepositoryPort,
} from '../../../../application/ports/out/usuarios.repository.port.js';
import { Usuario } from '../../../../domain/entities/usuario.entity.js';
import { NombreUsuarioDuplicadoError } from '../../../../domain/errors/auth.errors.js';
import type { NombreUsuario } from '../../../../domain/value-objects/nombre-usuario.vo.js';
import { esUuid } from './es-uuid.js';

const INDICE_NOMBRE_USUARIO = 'usuarios_nombre_usuario_key';
const COLUMNAS = {
  id: true,
  nombreUsuario: true,
  nombreCompleto: true,
  hashContrasena: true,
  debeCambiarContrasena: true,
  intentosFallidos: true,
  bloqueadoHasta: true,
  ultimaEmpresaId: true,
  ultimoIngresoEn: true,
  activo: true,
} as const;

/** `seguridad.usuarios`. */
@Injectable()
export class UsuariosPrismaRepository implements UsuariosRepositoryPort {
  constructor(private readonly txHost: TransaccionPrisma) {}

  async buscarPorId(id: string): Promise<Usuario | null> {
    if (!esUuid(id)) {
      return null;
    }
    const fila = await this.txHost.tx.usuario.findUnique({ where: { id }, select: COLUMNAS });
    return fila === null ? null : Usuario.reconstruir(fila);
  }

  async buscarParaActualizar(id: string): Promise<Usuario | null> {
    if (!esUuid(id)) {
      return null;
    }
    await this.txHost.tx
      .$queryRaw`SELECT 1 FROM seguridad.usuarios WHERE id = ${id}::uuid FOR UPDATE`;
    return this.buscarPorId(id);
  }

  async buscarPorNombreUsuario(nombre: NombreUsuario): Promise<Usuario | null> {
    const fila = await this.txHost.tx.usuario.findUnique({
      where: { nombreUsuario: nombre.valor },
      select: COLUMNAS,
    });
    return fila === null ? null : Usuario.reconstruir(fila);
  }

  async crear(nuevo: NuevoUsuario, creadoPor: string | null): Promise<Usuario> {
    try {
      const fila = await this.txHost.tx.usuario.create({
        data: {
          nombreUsuario: nuevo.nombreUsuario.valor,
          nombreCompleto: nuevo.nombreCompleto.valor,
          hashContrasena: nuevo.hashContrasena,
          debeCambiarContrasena: nuevo.debeCambiarContrasena,
          creadoPor,
          actualizadoPor: creadoPor,
        },
        select: COLUMNAS,
      });
      return Usuario.reconstruir(fila);
    } catch (error) {
      throw indiceUnicoViolado(error, INDICE_NOMBRE_USUARIO)
        ? new NombreUsuarioDuplicadoError()
        : error;
    }
  }

  async guardar(usuario: Usuario, actualizadoPor: string | null): Promise<void> {
    const { id, nombreUsuario: _noCambia, ...datos } = usuario.datos();
    await this.txHost.tx.usuario.update({ where: { id }, data: { ...datos, actualizadoPor } });
  }

  /**
   * SQL a mano: el filtro y el orden van sin mayúsculas ni tildes (`nombre_normalizado()`), y
   * los roles de cada fila salen en la misma consulta (`json_agg`), sin una consulta por fila.
   * «De la empresa» = con alguna fila en `usuarios_roles` de esa empresa (índice
   * `(empresa_id, usuario_id)`).
   */
  async listarDeEmpresa(
    empresaId: string,
    filtros: FiltrosUsuarios,
    pedido: PedidoPagina,
  ): Promise<{ elementos: UsuarioResumenGuardado[]; total: number }> {
    if (!esUuid(empresaId) || (filtros.rolId !== undefined && !esUuid(filtros.rolId))) {
      return { elementos: [], total: 0 };
    }
    const delRol =
      filtros.rolId === undefined
        ? Prisma.empty
        : Prisma.sql`AND ur.rol_id = ${filtros.rolId}::uuid`;
    const condiciones = [
      Prisma.sql`EXISTS (
        SELECT 1 FROM seguridad.usuarios_roles ur
        WHERE ur.usuario_id = u.id AND ur.empresa_id = ${empresaId}::uuid ${delRol})`,
    ];
    if (filtros.activo !== undefined) {
      condiciones.push(Prisma.sql`u.activo = ${filtros.activo}`);
    }
    const texto = filtros.texto?.trim() ?? '';
    if (texto !== '') {
      const patron = `%${texto.replace(/[\\%_]/gu, '\\$&')}%`;
      condiciones.push(Prisma.sql`(
        public.nombre_normalizado(u.nombre_completo) LIKE public.nombre_normalizado(${patron})
        OR u.nombre_usuario LIKE public.nombre_normalizado(${patron}))`);
    }
    const donde = Prisma.join(condiciones, ' AND ');
    const [elementos, cuenta] = await Promise.all([
      this.txHost.tx.$queryRaw<UsuarioResumenGuardado[]>`
        SELECT u.id, u.nombre_usuario AS "nombreUsuario", u.nombre_completo AS "nombreCompleto",
               u.activo, u.bloqueado_hasta AS "bloqueadoHasta",
               u.ultimo_ingreso_en AS "ultimoIngresoEn",
               u.debe_cambiar_contrasena AS "debeCambiarContrasena",
               (SELECT json_agg(
                         json_build_object('id', r.id, 'nombre', r.nombre,
                                           'esAdministrador', r.es_administrador,
                                           'activo', r.activo)
                         ORDER BY public.nombre_normalizado(r.nombre), r.id)
                  FROM seguridad.usuarios_roles ur
                  JOIN seguridad.roles r ON r.id = ur.rol_id
                 WHERE ur.usuario_id = u.id AND ur.empresa_id = ${empresaId}::uuid) AS roles
        FROM seguridad.usuarios u
        WHERE ${donde}
        ORDER BY public.nombre_normalizado(u.nombre_completo), u.id
        LIMIT ${pedido.tamano} OFFSET ${desplazamiento(pedido)}`,
      this.txHost.tx.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS total FROM seguridad.usuarios u WHERE ${donde}`,
    ]);
    return { elementos, total: cuenta[0]?.total ?? 0 };
  }
}
