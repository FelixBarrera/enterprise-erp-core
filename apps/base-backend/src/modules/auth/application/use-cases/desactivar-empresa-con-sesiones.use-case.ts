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
import {
  DESACTIVAR_EMPRESA_PORT,
  type DesactivarEmpresaPort,
} from '../../../empresas/application/ports/in/desactivar-empresa.port.js';
import { MotivoCierreSesion } from '../../domain/entities/sesion.entity.js';
import type {
  DesactivarEmpresaConSesionesPort,
  ResultadoDesactivarEmpresaConSesiones,
} from '../ports/in/desactivar-empresa-con-sesiones.port.js';
import {
  SESIONES_REPOSITORY_PORT,
  type SesionesRepositoryPort,
} from '../ports/out/sesiones.repository.port.js';

/**
 * `empresas` no conoce las sesiones (ARQ-02): por eso esto vive en `auth` y usa el puerto de
 * entrada de `empresas`, igual que crear una empresa con su administrador.
 */
@Injectable()
export class DesactivarEmpresaConSesionesUseCase implements DesactivarEmpresaConSesionesPort {
  constructor(
    @Inject(DESACTIVAR_EMPRESA_PORT) private readonly desactivarEmpresa: DesactivarEmpresaPort,
    @Inject(SESIONES_REPOSITORY_PORT) private readonly sesiones: SesionesRepositoryPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  desactivar(id: string, actor: Actor): Promise<ResultadoDesactivarEmpresaConSesiones> {
    // La transacción de `empresas` se une a esta: si cerrar las sesiones falla, la empresa
    // sigue activa.
    return this.unidad.ejecutar(async () => {
      const resultado = await this.desactivarEmpresa.desactivar(id, actor);
      const sesionesCerradas = await this.sesiones.cerrarTodasDeEmpresa(
        resultado.empresa.id,
        MotivoCierreSesion.EMPRESA_DESACTIVADA,
        this.reloj.ahora(),
      );
      if (sesionesCerradas > 0) {
        await this.auditoria.registrar(
          {
            accion: 'auth.sesion.cerrar',
            entidad: 'empresa',
            entidadId: resultado.empresa.id,
            entidadNombre: resultado.empresa.nombre,
            despues: { motivoCierre: MotivoCierreSesion.EMPRESA_DESACTIVADA, sesionesCerradas },
          },
          { ...actor, empresaId: resultado.empresa.id },
        );
      }
      return { ...resultado, sesionesCerradas };
    });
  }
}
