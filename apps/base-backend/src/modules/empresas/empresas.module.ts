import { Module } from '@nestjs/common';
import { CONSULTAR_EMPRESAS_PORT } from './application/ports/in/consultar-empresas.port.js';
import { CREAR_EMPRESA_PORT } from './application/ports/in/crear-empresa.port.js';
import { DESACTIVAR_EMPRESA_PORT } from './application/ports/in/desactivar-empresa.port.js';
import { EMPRESA_ACTIVA_PORT } from './application/ports/in/empresa-activa.port.js';
import { RENOMBRAR_EMPRESA_PORT } from './application/ports/in/renombrar-empresa.port.js';
import { EMPRESAS_REPOSITORY_PORT } from './application/ports/out/empresas.repository.port.js';
import { ConsultarEmpresasUseCase } from './application/use-cases/consultar-empresas.use-case.js';
import { CrearEmpresaUseCase } from './application/use-cases/crear-empresa.use-case.js';
import { DesactivarEmpresaUseCase } from './application/use-cases/desactivar-empresa.use-case.js';
import { EmpresaActivaUseCase } from './application/use-cases/empresa-activa.use-case.js';
import { RenombrarEmpresaUseCase } from './application/use-cases/renombrar-empresa.use-case.js';
import { EmpresaController } from './infrastructure/adapters/in/http/empresa.controller.js';
import { EmpresasPrismaRepository } from './infrastructure/adapters/out/prisma/empresas.prisma.repository.js';

/**
 * Las empresas de la instalación (docs/modulos/empresas.md). Dueño de `organizacion.empresas`.
 * Otros módulos (auth) lo importan y usan solo sus puertos de entrada. Por la API, solo
 * `GET`/`PATCH /empresa` (6.7a); crear, desactivar y renombrar cualquier empresa van solo por
 * comando (EMP-D2, 6.15a).
 */
@Module({
  controllers: [EmpresaController],
  providers: [
    { provide: EMPRESAS_REPOSITORY_PORT, useClass: EmpresasPrismaRepository },
    { provide: CONSULTAR_EMPRESAS_PORT, useClass: ConsultarEmpresasUseCase },
    { provide: CREAR_EMPRESA_PORT, useClass: CrearEmpresaUseCase },
    { provide: DESACTIVAR_EMPRESA_PORT, useClass: DesactivarEmpresaUseCase },
    { provide: EMPRESA_ACTIVA_PORT, useClass: EmpresaActivaUseCase },
    { provide: RENOMBRAR_EMPRESA_PORT, useClass: RenombrarEmpresaUseCase },
  ],
  exports: [
    CONSULTAR_EMPRESAS_PORT,
    CREAR_EMPRESA_PORT,
    DESACTIVAR_EMPRESA_PORT,
    RENOMBRAR_EMPRESA_PORT,
  ],
})
export class EmpresasModule {}
