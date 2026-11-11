import { Global, Module } from '@nestjs/common';
import type { Request } from 'express';
import { ClsModule } from 'nestjs-cls';
import { CONTEXTO_PETICION_PORT } from '../../application/ports/contexto-peticion.port.js';
import { ContextoPeticionCls, type DatosPeticion } from './contexto-peticion.cls.js';
import { elegirRequestId } from './request-id.js';

/**
 * Contexto de cada petición (nestjs-cls). Global: `@Inject(CONTEXTO_PETICION_PORT)` en
 * cualquier caso de uso. Las transacciones (5.9) también usan nestjs-cls.
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        // `asignarRequestId` (configureApp) ya lo puso en req.id; el respaldo es por si no corrió.
        idGenerator: (req: Request) =>
          typeof req.id === 'string' ? req.id : elegirRequestId(undefined),
        setup: (cls, req: Request) => {
          const datos: Omit<DatosPeticion, symbol> = {
            ip: req.ip ?? null,
            navegador: req.headers['user-agent'] ?? null,
          };
          cls.set('ip', datos.ip);
          cls.set('navegador', datos.navegador);
        },
      },
    }),
  ],
  providers: [{ provide: CONTEXTO_PETICION_PORT, useClass: ContextoPeticionCls }],
  exports: [CONTEXTO_PETICION_PORT],
})
export class ContextoModule {}
