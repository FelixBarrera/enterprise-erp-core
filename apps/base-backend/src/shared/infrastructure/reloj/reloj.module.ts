import { Global, Module } from '@nestjs/common';
import { RELOJ_PORT } from '../../application/ports/reloj.port.js';
import { RelojSistema } from './reloj-sistema.js';

/** Global: cualquier caso de uso puede pedir `@Inject(RELOJ_PORT)` sin importar este módulo. */
@Global()
@Module({
  providers: [{ provide: RELOJ_PORT, useClass: RelojSistema }],
  exports: [RELOJ_PORT],
})
export class RelojModule {}
