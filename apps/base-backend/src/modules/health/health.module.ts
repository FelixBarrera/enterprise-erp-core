import { Module } from '@nestjs/common';
import { CONSULTAR_SALUD_PORT } from './application/ports/in/consultar-salud.port.js';
import { VERIFICADOR_BASE_DATOS_PORT } from './application/ports/out/verificador-base-datos.port.js';
import { ConsultarSaludUseCase } from './application/use-cases/consultar-salud.use-case.js';
import { HealthController } from './infrastructure/adapters/in/http/health.controller.js';
import { VerificadorBaseDatosPrisma } from './infrastructure/adapters/out/prisma/verificador-base-datos.prisma.js';

/**
 * Módulo de referencia mínimo: las tres capas con un puerto de entrada y uno de salida.
 * Ante la duda sobre cómo armar un módulo, mirar este (y `auditoria` desde el paso 6).
 */
@Module({
  controllers: [HealthController],
  providers: [
    { provide: CONSULTAR_SALUD_PORT, useClass: ConsultarSaludUseCase },
    { provide: VERIFICADOR_BASE_DATOS_PORT, useClass: VerificadorBaseDatosPrisma },
  ],
})
export class HealthModule {}
