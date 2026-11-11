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
import { NombreEmpresa } from '../../domain/value-objects/nombre-empresa.vo.js';
import type { EmpresaConsultada } from '../ports/in/consultar-empresas.port.js';
import type { EditarEmpresaComando, EmpresaActivaPort } from '../ports/in/empresa-activa.port.js';
import {
  EMPRESAS_REPOSITORY_PORT,
  type EmpresasRepositoryPort,
} from '../ports/out/empresas.repository.port.js';
import { aEmpresaConsultada } from './a-consultada.js';
import { renombrarEmpresa } from './renombrar.js';

/**
 * Siempre la empresa activa de quien opera (la de su sesión): nadie ve ni edita otra empresa por
 * la API, ni siquiera mandando su id (no se recibe).
 */
@Injectable()
export class EmpresaActivaUseCase implements EmpresaActivaPort {
  constructor(
    @Inject(EMPRESAS_REPOSITORY_PORT) private readonly empresas: EmpresasRepositoryPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  async ver(actor: Actor): Promise<EmpresaConsultada> {
    // El guard ya revisó que la empresa de la sesión esté activa; esto cubre la carrera.
    const empresa =
      actor.empresaId === null ? null : await this.empresas.buscarPorId(actor.empresaId);
    if (empresa?.activo !== true) {
      throw new EmpresaNoEncontradaError();
    }
    return aEmpresaConsultada(empresa);
  }

  async editar(comando: EditarEmpresaComando, actor: Actor): Promise<EmpresaConsultada> {
    // Antes de abrir la transacción: un nombre inválido no toca la base.
    const nombre = comando.nombre === undefined ? null : NombreEmpresa.crear(comando.nombre);
    const empresaId = actor.empresaId;
    if (empresaId === null) {
      throw new EmpresaNoEncontradaError();
    }
    if (nombre === null) {
      return this.ver(actor);
    }
    return this.unidad.ejecutar(async () => {
      const { empresa } = await renombrarEmpresa(empresaId, nombre, actor, {
        empresas: this.empresas,
        auditoria: this.auditoria,
      });
      return aEmpresaConsultada(empresa);
    });
  }
}
