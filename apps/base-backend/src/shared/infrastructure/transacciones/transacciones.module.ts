import { Global, Module } from '@nestjs/common';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';
import { UNIDAD_DE_TRABAJO_PORT } from '../../application/ports/unidad-de-trabajo.port.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UnidadDeTrabajoCls } from './unidad-de-trabajo.cls.js';

/**
 * Transacciones con nestjs-cls (el mismo que guarda el contexto de cada petición).
 * Global: cualquier caso de uso pide `@Inject(UNIDAD_DE_TRABAJO_PORT)` y cualquier repositorio
 * inyecta `TransaccionPrisma`, sin importar este módulo.
 */
@Global()
@Module({
  imports: [
    ClsModule.registerPlugins([
      new ClsPluginTransactional({
        imports: [PrismaModule],
        adapter: new TransactionalAdapterPrisma<PrismaService>({
          prismaInjectionToken: PrismaService,
        }),
      }),
    ]),
  ],
  providers: [{ provide: UNIDAD_DE_TRABAJO_PORT, useClass: UnidadDeTrabajoCls }],
  exports: [UNIDAD_DE_TRABAJO_PORT],
})
export class TransaccionesModule {}
