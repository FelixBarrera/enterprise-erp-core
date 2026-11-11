import { Injectable, Logger } from '@nestjs/common';
import { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import type { VerificadorBaseDatosPort } from '../../../../application/ports/out/verificador-base-datos.port.js';

/** Tiempo máximo para que la base conteste: el health check no puede quedarse colgado. */
export const TIEMPO_MAXIMO_BASE_DATOS_MS = 2000;

@Injectable()
export class VerificadorBaseDatosPrisma implements VerificadorBaseDatosPort {
  private readonly logger = new Logger(VerificadorBaseDatosPrisma.name);

  constructor(private readonly txHost: TransaccionPrisma) {}

  async responde(): Promise<boolean> {
    let temporizador: NodeJS.Timeout | undefined;
    const vencido = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(
        () => rechazar(new Error(`sin respuesta en ${TIEMPO_MAXIMO_BASE_DATOS_MS} ms`)),
        TIEMPO_MAXIMO_BASE_DATOS_MS,
      );
    });
    try {
      await Promise.race([this.txHost.tx.$queryRaw`SELECT 1`, vencido]);
      return true;
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      this.logger.error(`La base de datos no responde: ${motivo}`);
      return false;
    } finally {
      clearTimeout(temporizador);
    }
  }
}
