import type { Actor } from '../../../../shared/application/actor.js';
import type { RegistrarAuditoriaPort } from '../../../auditoria/application/ports/in/registrar-auditoria.port.js';
import type { Empresa } from '../../domain/entities/empresa.entity.js';
import {
  EmpresaInactivaError,
  EmpresaNoEncontradaError,
} from '../../domain/errors/empresas.errors.js';
import type { NombreEmpresa } from '../../domain/value-objects/nombre-empresa.vo.js';
import type { EmpresasRepositoryPort } from '../ports/out/empresas.repository.port.js';

/**
 * Cambia el nombre de una empresa activa y registra `empresas.empresa.editar` en esa empresa (así
 * su administrador lo ve en la bitácora). Va dentro de la transacción de quien lo llama
 * (`PATCH /empresa` y `admin:renombrar-empresa`). Si el nombre es el mismo, no escribe ni registra.
 */
export async function renombrarEmpresa(
  id: string,
  nombre: NombreEmpresa,
  actor: Actor,
  dependencias: {
    readonly empresas: EmpresasRepositoryPort;
    readonly auditoria: RegistrarAuditoriaPort;
  },
): Promise<{ readonly empresa: Empresa; readonly cambio: boolean }> {
  const { empresas, auditoria } = dependencias;
  const empresa = await empresas.buscarParaActualizar(id);
  if (empresa === null) {
    throw new EmpresaNoEncontradaError();
  }
  if (!empresa.activo) {
    throw new EmpresaInactivaError();
  }
  if (nombre.valor === empresa.nombre.valor) {
    return { empresa, cambio: false };
  }
  const renombrada = empresa.renombrar(nombre);
  await empresas.guardar(renombrada, actor.usuarioId);
  await auditoria.registrar(
    {
      accion: 'empresas.empresa.editar',
      entidad: 'empresa',
      entidadId: empresa.id,
      entidadNombre: renombrada.nombre.valor,
      antes: { nombre: empresa.nombre.valor },
      despues: { nombre: renombrada.nombre.valor },
    },
    { ...actor, empresaId: empresa.id },
  );
  return { empresa: renombrada, cambio: true };
}
