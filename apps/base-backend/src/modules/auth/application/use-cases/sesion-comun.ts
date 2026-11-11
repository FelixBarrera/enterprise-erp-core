import type { Actor } from '../../../../shared/application/actor.js';
import type { ContextoPeticionPort } from '../../../../shared/application/ports/contexto-peticion.port.js';
import type {
  ConsultarEmpresasPort,
  EmpresaConsultada,
} from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import type { RolesRepositoryPort } from '../ports/out/roles.repository.port.js';

/**
 * Las empresas en las que el usuario puede trabajar: con al menos un rol activo y la empresa
 * activa (AUTH-D2), ordenadas por nombre.
 */
export async function empresasDisponibles(
  usuarioId: string,
  roles: RolesRepositoryPort,
  empresas: ConsultarEmpresasPort,
): Promise<EmpresaConsultada[]> {
  const ids = await roles.empresasConAcceso(usuarioId);
  if (ids.length === 0) {
    return [];
  }
  return (await empresas.nombres(ids)).filter((empresa) => empresa.activo);
}

/** El usuario que hace la operación, en esa empresa y desde la petición en curso. */
export function actorDeUsuario(
  usuario: Usuario,
  empresaId: string | null,
  contexto: ContextoPeticionPort,
): Actor {
  return {
    usuarioId: usuario.id,
    nombreUsuario: usuario.nombreUsuario.valor,
    empresaId,
    ip: contexto.ip(),
    navegador: contexto.navegador(),
    requestId: contexto.requestId(),
  };
}
