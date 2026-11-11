import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/application/actor.js';
import { RELOJ_PORT, type RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import { armarEventoAuditoria } from '../../domain/evento-auditoria.js';
import type {
  DatosEventoAuditoria,
  RegistrarAuditoriaPort,
} from '../ports/in/registrar-auditoria.port.js';
import {
  EVENTOS_AUDITORIA_REPOSITORY_PORT,
  type EventosAuditoriaRepositoryPort,
} from '../ports/out/eventos-auditoria.repository.port.js';

@Injectable()
export class RegistrarAuditoriaUseCase implements RegistrarAuditoriaPort {
  constructor(
    // Registrar solo agrega: no necesita el resto del repositorio.
    @Inject(EVENTOS_AUDITORIA_REPOSITORY_PORT)
    private readonly eventos: Pick<EventosAuditoriaRepositoryPort, 'guardar'>,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
  ) {}

  async registrar(datos: DatosEventoAuditoria, actor: Actor): Promise<void> {
    const evento = armarEventoAuditoria(datos, actor, this.reloj.ahora());
    if (evento !== null) {
      await this.eventos.guardar(evento);
    }
  }
}
