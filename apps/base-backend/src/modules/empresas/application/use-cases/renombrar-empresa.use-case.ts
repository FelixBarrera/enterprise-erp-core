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
import { NombreEmpresa } from '../../domain/value-objects/nombre-empresa.vo.js';
import type {
  RenombrarEmpresaPort,
  ResultadoRenombrarEmpresa,
} from '../ports/in/renombrar-empresa.port.js';
import {
  EMPRESAS_REPOSITORY_PORT,
  type EmpresasRepositoryPort,
} from '../ports/out/empresas.repository.port.js';
import { aEmpresaConsultada } from './a-consultada.js';
import { renombrarEmpresa } from './renombrar.js';

@Injectable()
export class RenombrarEmpresaUseCase implements RenombrarEmpresaPort {
  constructor(
    @Inject(EMPRESAS_REPOSITORY_PORT) private readonly empresas: EmpresasRepositoryPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  async renombrar(id: string, nombre: string, actor: Actor): Promise<ResultadoRenombrarEmpresa> {
    // Antes de abrir la transacción: un nombre inválido no toca la base.
    const nuevo = NombreEmpresa.crear(nombre);
    return this.unidad.ejecutar(async () => {
      const { empresa, cambio } = await renombrarEmpresa(id, nuevo, actor, {
        empresas: this.empresas,
        auditoria: this.auditoria,
      });
      return { empresa: aEmpresaConsultada(empresa), cambio };
    });
  }
}
