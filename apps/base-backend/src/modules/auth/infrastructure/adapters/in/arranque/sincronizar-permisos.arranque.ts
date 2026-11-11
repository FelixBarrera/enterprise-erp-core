import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import {
  SINCRONIZAR_PERMISOS_PORT,
  type SincronizarPermisosPort,
} from '../../../../application/ports/in/sincronizar-permisos.port.js';

/**
 * Al arrancar (la API y los comandos `admin:*`), antes de atender peticiones: copia el catálogo
 * de permisos a la base. Si el catálogo está mal o la base no responde, la API no arranca.
 */
@Injectable()
export class SincronizarPermisosAlArrancar implements OnApplicationBootstrap {
  private readonly logger = new Logger(SincronizarPermisosAlArrancar.name);

  constructor(
    @Inject(SINCRONIZAR_PERMISOS_PORT) private readonly sincronizar: SincronizarPermisosPort,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { creados, actualizados, obsoletos } = await this.sincronizar.execute();
    if (creados.length + actualizados.length + obsoletos.length === 0) {
      this.logger.log('Catálogo de permisos al día');
      return;
    }
    this.logger.log(
      `Catálogo de permisos: ${creados.length} nuevos, ${actualizados.length} actualizados, ` +
        `${obsoletos.length} obsoletos`,
    );
    if (obsoletos.length > 0) {
      // Un rol que los tenía los pierde: que quede a la vista de quien despliega.
      this.logger.warn(`Permisos que el código ya no declara: ${obsoletos.join(', ')}`);
    }
  }
}
