import { Inject, Injectable } from '@nestjs/common';
import type {
  ConsultarEmpresasPort,
  EmpresaConsultada,
} from '../ports/in/consultar-empresas.port.js';
import {
  EMPRESAS_REPOSITORY_PORT,
  type EmpresasRepositoryPort,
} from '../ports/out/empresas.repository.port.js';
import { aEmpresaConsultada } from './a-consultada.js';

@Injectable()
export class ConsultarEmpresasUseCase implements ConsultarEmpresasPort {
  constructor(
    @Inject(EMPRESAS_REPOSITORY_PORT) private readonly empresas: EmpresasRepositoryPort,
  ) {}

  async buscarActiva(id: string): Promise<EmpresaConsultada | null> {
    const empresa = await this.empresas.buscarPorId(id);
    return empresa?.activo === true ? aEmpresaConsultada(empresa) : null;
  }

  async nombres(ids: readonly string[]): Promise<EmpresaConsultada[]> {
    if (ids.length === 0) {
      return [];
    }
    const empresas = await this.empresas.buscarPorIds([...new Set(ids)]);
    return empresas.map(aEmpresaConsultada);
  }

  async listarActivas(): Promise<EmpresaConsultada[]> {
    const empresas = await this.empresas.listarActivas();
    return empresas.map(aEmpresaConsultada);
  }

  hayAlguna(): Promise<boolean> {
    return this.empresas.hayAlguna();
  }
}
