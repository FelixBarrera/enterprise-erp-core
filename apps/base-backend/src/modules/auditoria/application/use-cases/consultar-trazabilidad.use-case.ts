import { Inject, Injectable } from '@nestjs/common';
import type {
  ConsultarTrazabilidadPort,
  ConsultaTrazabilidad,
  Huella,
  Trazabilidad,
} from '../ports/in/consultar-trazabilidad.port.js';
import {
  EVENTOS_AUDITORIA_REPOSITORY_PORT,
  type EventosAuditoriaRepositoryPort,
  type UltimoEvento,
} from '../ports/out/eventos-auditoria.repository.port.js';

/**
 * El pie de una ficha: la última alta y el último cambio después de ella. Dos lecturas por el
 * índice de la entidad: la última alta y el último de todos (alta o cambio); si ese último es la
 * misma alta, no hubo cambios después.
 */
@Injectable()
export class ConsultarTrazabilidadUseCase implements ConsultarTrazabilidadPort {
  constructor(
    @Inject(EVENTOS_AUDITORIA_REPOSITORY_PORT)
    private readonly eventos: EventosAuditoriaRepositoryPort,
  ) {}

  async de(consulta: ConsultaTrazabilidad): Promise<Trazabilidad> {
    const registro = {
      empresaId: consulta.empresaId,
      entidad: consulta.entidad,
      entidadId: consulta.entidadId,
    };
    const [alta, ultimo] = await Promise.all([
      this.eventos.ultimoDe({ ...registro, acciones: consulta.accionesAlta }),
      this.eventos.ultimoDe({
        ...registro,
        acciones: [...consulta.accionesAlta, ...consulta.accionesCambio],
      }),
    ]);
    return {
      creado: alta === null ? null : huella(alta),
      modificado: ultimo === null || ultimo.id === alta?.id ? null : huella(ultimo),
    };
  }
}

function huella(evento: UltimoEvento): Huella {
  return { en: evento.ocurridoEn, por: evento.nombreUsuario };
}
