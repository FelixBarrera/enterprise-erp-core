import { Global, Module } from '@nestjs/common';
import { CONSULTAR_AUDITORIA_PORT } from './application/ports/in/consultar-auditoria.port.js';
import { CONSULTAR_TRAZABILIDAD_PORT } from './application/ports/in/consultar-trazabilidad.port.js';
import { REGISTRAR_AUDITORIA_PORT } from './application/ports/in/registrar-auditoria.port.js';
import { EVENTOS_AUDITORIA_REPOSITORY_PORT } from './application/ports/out/eventos-auditoria.repository.port.js';
import { ConsultarAuditoriaUseCase } from './application/use-cases/consultar-auditoria.use-case.js';
import { ConsultarTrazabilidadUseCase } from './application/use-cases/consultar-trazabilidad.use-case.js';
import { RegistrarAuditoriaUseCase } from './application/use-cases/registrar-auditoria.use-case.js';
import { AuditoriaController } from './infrastructure/adapters/in/http/auditoria.controller.js';
import { EventosAuditoriaPrismaRepository } from './infrastructure/adapters/out/prisma/eventos-auditoria.prisma.repository.js';

/**
 * La bitácora (docs/modulos/auditoria.md). Global: cualquier caso de uso pide
 * `@Inject(REGISTRAR_AUDITORIA_PORT)` sin importar este módulo. La consulta
 * (`GET /auditoria/eventos`, 6.8) es solo para la pantalla: no se exporta. El pie de las fichas
 * de otros módulos (`CONSULTAR_TRAZABILIDAD_PORT`, 6.12a0), sí.
 */
@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [
    { provide: CONSULTAR_AUDITORIA_PORT, useClass: ConsultarAuditoriaUseCase },
    { provide: REGISTRAR_AUDITORIA_PORT, useClass: RegistrarAuditoriaUseCase },
    { provide: CONSULTAR_TRAZABILIDAD_PORT, useClass: ConsultarTrazabilidadUseCase },
    { provide: EVENTOS_AUDITORIA_REPOSITORY_PORT, useClass: EventosAuditoriaPrismaRepository },
  ],
  exports: [REGISTRAR_AUDITORIA_PORT, CONSULTAR_TRAZABILIDAD_PORT],
})
export class AuditoriaModule {}
