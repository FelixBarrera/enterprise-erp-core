import { Injectable } from '@nestjs/common';
import { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import type {
  AccesoSesion,
  AccesosSesionPort,
} from '../../../../application/ports/out/accesos-sesion.repository.port.js';
import { type MotivoCierreSesion, Sesion } from '../../../../domain/entities/sesion.entity.js';
import { esUuid } from './es-uuid.js';

interface FilaAcceso {
  id: string;
  usuario_id: string;
  empresa_id: string;
  hash_refresh: string;
  hash_refresh_anterior: string | null;
  rotado_en: Date | null;
  iniciada_en: Date;
  vence_en: Date;
  ultimo_uso_en: Date;
  cerrada_en: Date | null;
  motivo_cierre: MotivoCierreSesion | null;
  ip: string | null;
  navegador: string | null;
  nombre_usuario: string;
  usuario_activo: boolean;
  debe_cambiar_contrasena: boolean;
  empresa_activa: boolean;
  tiene_rol_activo: boolean;
  es_administrador: boolean;
  tiene_permiso: boolean;
}

/**
 * La lectura del guard: sesión, usuario, empresa, roles y el permiso de la ruta en **una**
 * consulta por petición (DBA-02: medida con `EXPLAIN ANALYZE` en el 6.6b).
 * El permiso se busca por su código (único) y solo si está vigente; con `null`, la subconsulta
 * no encuentra nada y `tiene_permiso` sale `false`. Cada rol aporta a lo más una fila de
 * `roles_permisos` (la del permiso pedido), así que no cambia lo demás que se agrega. Lee `organizacion.empresas`
 * directamente (solo su `activo`): la sesión ya tiene la FK a esa tabla, y pasar por
 * `CONSULTAR_EMPRESAS_PORT` sería una consulta más en cada petición.
 */
@Injectable()
export class AccesosSesionPrismaRepository implements AccesosSesionPort {
  constructor(private readonly txHost: TransaccionPrisma) {}

  async buscar(sesionId: string, permiso: string | null): Promise<AccesoSesion | null> {
    if (!esUuid(sesionId)) {
      return null;
    }
    const [fila] = await this.txHost.tx.$queryRaw<FilaAcceso[]>`
      SELECT s.id, s.usuario_id, s.empresa_id, s.hash_refresh, s.hash_refresh_anterior,
             s.rotado_en, s.iniciada_en, s.vence_en, s.ultimo_uso_en, s.cerrada_en,
             s.motivo_cierre::text AS motivo_cierre, s.ip, s.navegador,
             u.nombre_usuario, u.activo AS usuario_activo, u.debe_cambiar_contrasena,
             e.activo AS empresa_activa,
             COALESCE(bool_or(r.id IS NOT NULL), false) AS tiene_rol_activo,
             COALESCE(bool_or(r.es_administrador), false) AS es_administrador,
             COALESCE(bool_or(rp.rol_id IS NOT NULL), false) AS tiene_permiso
      FROM seguridad.sesiones s
      JOIN seguridad.usuarios u ON u.id = s.usuario_id
      JOIN organizacion.empresas e ON e.id = s.empresa_id
      LEFT JOIN seguridad.usuarios_roles ur
             ON ur.usuario_id = s.usuario_id AND ur.empresa_id = s.empresa_id
      LEFT JOIN seguridad.roles r ON r.id = ur.rol_id AND r.activo
      LEFT JOIN seguridad.roles_permisos rp
             ON rp.rol_id = r.id
            AND rp.permiso_id = (SELECT p.id FROM seguridad.permisos p
                                 WHERE p.codigo = ${permiso}::text AND NOT p.obsoleto)
      WHERE s.id = ${sesionId}::uuid
      GROUP BY s.id, u.id, e.id`;
    if (fila === undefined) {
      return null;
    }
    return {
      sesion: Sesion.reconstruir({
        id: fila.id,
        usuarioId: fila.usuario_id,
        empresaId: fila.empresa_id,
        hashRefresh: fila.hash_refresh,
        hashRefreshAnterior: fila.hash_refresh_anterior,
        rotadoEn: fila.rotado_en,
        iniciadaEn: fila.iniciada_en,
        venceEn: fila.vence_en,
        ultimoUsoEn: fila.ultimo_uso_en,
        cerradaEn: fila.cerrada_en,
        motivoCierre: fila.motivo_cierre,
        ip: fila.ip,
        navegador: fila.navegador,
      }),
      usuario: {
        nombreUsuario: fila.nombre_usuario,
        activo: fila.usuario_activo,
        debeCambiarContrasena: fila.debe_cambiar_contrasena,
      },
      empresaActiva: fila.empresa_activa,
      tieneRolActivo: fila.tiene_rol_activo,
      esAdministrador: fila.es_administrador,
      tienePermiso: fila.tiene_permiso,
    };
  }
}
