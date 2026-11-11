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
import type { EmpresaConsultada } from '../ports/in/consultar-empresas.port.js';
import type { CrearEmpresaComando, CrearEmpresaPort } from '../ports/in/crear-empresa.port.js';
import {
  EMPRESAS_REPOSITORY_PORT,
  type EmpresasRepositoryPort,
} from '../ports/out/empresas.repository.port.js';
import { aEmpresaConsultada } from './a-consultada.js';

@Injectable()
export class CrearEmpresaUseCase implements CrearEmpresaPort {
  constructor(
    @Inject(EMPRESAS_REPOSITORY_PORT) private readonly empresas: EmpresasRepositoryPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  async crear(comando: CrearEmpresaComando, actor: Actor): Promise<EmpresaConsultada> {
    const nombre = NombreEmpresa.crear(comando.nombre);
    return this.unidad.ejecutar(async () => {
      const empresa = await this.empresas.crear(nombre, actor.usuarioId);
      // El evento va en la empresa nueva: así lo ve su administrador en la bitácora.
      await this.auditoria.registrar(
        {
          accion: 'empresas.empresa.crear',
          entidad: 'empresa',
          entidadId: empresa.id,
          entidadNombre: empresa.nombre.valor,
          despues: { nombre: empresa.nombre.valor, activo: empresa.activo },
        },
        { ...actor, empresaId: empresa.id },
      );
      return aEmpresaConsultada(empresa);
    });
  }
}
