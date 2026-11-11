import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/application/actor.js';
import { RELOJ_PORT, type RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../../../../shared/application/ports/unidad-de-trabajo.port.js';
import {
  REGISTRAR_AUDITORIA_PORT,
  type RegistrarAuditoriaPort,
} from '../../../auditoria/application/ports/in/registrar-auditoria.port.js';
import { MotivoCierreSesion } from '../../domain/entities/sesion.entity.js';
import type { CerrarSesionPort } from '../ports/in/cerrar-sesion.port.js';
import {
  SESIONES_REPOSITORY_PORT,
  type SesionesRepositoryPort,
} from '../ports/out/sesiones.repository.port.js';

@Injectable()
export class CerrarSesionUseCase implements CerrarSesionPort {
  constructor(
    @Inject(SESIONES_REPOSITORY_PORT) private readonly sesiones: SesionesRepositoryPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  async execute(sesionId: string, actor: Actor): Promise<void> {
    await this.unidad.ejecutar(async () => {
      // Con la fila bloqueada: un refresh al mismo tiempo no la deja abierta otra vez.
      const sesion = await this.sesiones.buscarParaActualizar(sesionId);
      if (sesion === null || !sesion.estaAbierta()) {
        // Ya estaba cerrada (dos "Salir" seguidos): no hay nada que cerrar ni que registrar.
        return;
      }
      await this.sesiones.guardar(sesion.cerrar(MotivoCierreSesion.SALIDA, this.reloj.ahora()));
      await this.auditoria.registrar(
        {
          accion: 'auth.sesion.cerrar',
          entidad: 'sesion',
          entidadId: sesion.id,
          entidadNombre: actor.nombreUsuario,
          despues: { motivoCierre: MotivoCierreSesion.SALIDA },
        },
        actor,
      );
    });
  }
}
