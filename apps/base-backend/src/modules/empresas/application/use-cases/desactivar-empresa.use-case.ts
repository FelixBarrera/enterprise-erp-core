import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/application/actor.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../../../../shared/application/ports/unidad-de-trabajo.port.js';
import {
  REGISTRAR_AUDITORIA_PORT,
  type RegistrarAuditoriaPort,
} from '../../../auditoria/application/ports/in/registrar-auditoria.port.js';
import { EmpresaNoEncontradaError } from '../../domain/errors/empresas.errors.js';
import type {
  DesactivarEmpresaPort,
  ResultadoDesactivarEmpresa,
} from '../ports/in/desactivar-empresa.port.js';
import {
  EMPRESAS_REPOSITORY_PORT,
  type EmpresasRepositoryPort,
} from '../ports/out/empresas.repository.port.js';
import { aEmpresaConsultada } from './a-consultada.js';

@Injectable()
export class DesactivarEmpresaUseCase implements DesactivarEmpresaPort {
  constructor(
    @Inject(EMPRESAS_REPOSITORY_PORT) private readonly empresas: EmpresasRepositoryPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  desactivar(id: string, actor: Actor): Promise<ResultadoDesactivarEmpresa> {
    return this.unidad.ejecutar(async () => {
      const empresa = await this.empresas.buscarPorId(id);
      if (empresa === null) {
        throw new EmpresaNoEncontradaError();
      }
      if (!empresa.activo) {
        // Correr el comando dos veces no rompe nada (OPS-03).
        return { empresa: aEmpresaConsultada(empresa), yaEstabaDesactivada: true };
      }
      const desactivada = empresa.desactivar();
      await this.empresas.guardar(desactivada, actor.usuarioId);
      await this.auditoria.registrar(
        {
          accion: 'empresas.empresa.desactivar',
          entidad: 'empresa',
          entidadId: empresa.id,
          entidadNombre: empresa.nombre.valor,
          antes: { activo: true },
          despues: { activo: false },
        },
        { ...actor, empresaId: empresa.id },
      );
      return { empresa: aEmpresaConsultada(desactivada), yaEstabaDesactivada: false };
    });
  }
}
