import { Inject, Injectable } from '@nestjs/common';
import { RELOJ_PORT, type RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../../../../shared/application/ports/unidad-de-trabajo.port.js';
import { CatalogoPermisos } from '../../domain/services/catalogo-permisos.js';
import type {
  ResumenSincronizacion,
  SincronizarPermisosPort,
} from '../ports/in/sincronizar-permisos.port.js';
import {
  CATALOGO_PERMISOS_PORT,
  type CatalogoPermisosDeclarado,
} from '../ports/out/catalogo-permisos.port.js';
import {
  PERMISOS_REPOSITORY_PORT,
  type PermisosRepositoryPort,
} from '../ports/out/permisos.repository.port.js';

/**
 * El catálogo de permisos del código → la base (docs/arquitectura-backend.md, sección 14). No va
 * a la bitácora: el catálogo no es de una empresa ni lo cambia una persona (lo cambia un
 * despliegue, que ya queda en git); el resumen va al log del arranque.
 */
@Injectable()
export class SincronizarPermisosUseCase implements SincronizarPermisosPort {
  constructor(
    @Inject(CATALOGO_PERMISOS_PORT) private readonly declarado: CatalogoPermisosDeclarado,
    @Inject(PERMISOS_REPOSITORY_PORT) private readonly permisos: PermisosRepositoryPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
  ) {}

  async execute(): Promise<ResumenSincronizacion> {
    // Antes de tocar la base: un catálogo mal escrito no escribe nada.
    const catalogo = CatalogoPermisos.desde(this.declarado);
    return this.unidad.ejecutar(async () => {
      await this.permisos.bloquearCatalogo();
      const plan = catalogo.planContra(await this.permisos.listar());
      if (plan.nuevos.length > 0) {
        await this.permisos.crear(plan.nuevos, this.reloj.ahora());
      }
      const cambiados = [...plan.cambiados, ...plan.obsoletos];
      if (cambiados.length > 0) {
        await this.permisos.actualizar(cambiados, this.reloj.ahora());
      }
      return {
        creados: plan.nuevos.map((p) => p.codigo),
        actualizados: plan.cambiados.map((p) => p.codigo),
        obsoletos: plan.obsoletos.map((p) => p.codigo),
      };
    });
  }
}
