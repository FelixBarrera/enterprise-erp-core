import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { EmpresasModule } from './modules/empresas/empresas.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { validarEntorno } from './shared/infrastructure/config/validar-entorno.js';
import { ContextoModule } from './shared/infrastructure/contexto/contexto.module.js';
import { LimitePeticionesModule } from './shared/infrastructure/limite/limite-peticiones.module.js';
import { LogsModule } from './shared/infrastructure/logger/logs.module.js';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';
import { RedisModule } from './shared/infrastructure/redis/redis.module.js';
import { RelojModule } from './shared/infrastructure/reloj/reloj.module.js';
import { TransaccionesModule } from './shared/infrastructure/transacciones/transacciones.module.js';
import { ZonaNegocioModule } from './shared/infrastructure/zona/zona-negocio.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),
    ZonaNegocioModule,
    ContextoModule,
    LogsModule,
    PrismaModule,
    RedisModule,
    LimitePeticionesModule,
    RelojModule,
    TransaccionesModule,
    AuditoriaModule,
    EmpresasModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
