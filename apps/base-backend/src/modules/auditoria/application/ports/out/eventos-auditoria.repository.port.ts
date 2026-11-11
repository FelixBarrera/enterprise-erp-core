import type { PedidoPagina } from '../../../../../shared/application/pagina.js';
import type { EventoAuditoria } from '../../../domain/evento-auditoria.js';
import type { RangoAbierto } from '../../../domain/rango-consulta.js';

export const EVENTOS_AUDITORIA_REPOSITORY_PORT = Symbol('EVENTOS_AUDITORIA_REPOSITORY_PORT');

/** Un evento ya guardado. */
export interface EventoAuditoriaGuardado extends EventoAuditoria {
  readonly id: string;
}

/** Una fila de la lista: sin `antes` ni `despues`, que pueden ser grandes. */
export type EventoResumenGuardado = Omit<EventoAuditoriaGuardado, 'antes' | 'despues'>;

/** Lo que busca la lista, ya en instantes (sin un extremo: sin tope de ese lado). */
export interface FiltrosEventos extends RangoAbierto {
  readonly usuarioId?: string;
  /** Exacta, o todas las que empiezan por `accion.` */
  readonly accion?: string;
  readonly entidad?: string;
  readonly entidadId?: string;
}

/** Lo que hace falta del último evento de un registro para el pie de una ficha. */
export interface UltimoEvento {
  readonly id: string;
  readonly ocurridoEn: Date;
  readonly nombreUsuario: string | null;
}

/** Qué registro y cuáles de sus acciones. */
export interface BusquedaUltimoEvento {
  readonly empresaId: string;
  readonly entidad: string;
  readonly entidadId: string;
  readonly acciones: readonly string[];
}

/** Alguien que aparece en la bitácora de una empresa. */
export interface UsuarioDeBitacora {
  readonly usuarioId: string;
  /** El de su evento más nuevo (el nombre de usuario no cambia: AUTH-D3). */
  readonly nombreUsuario: string;
}

export interface EventosAuditoriaRepositoryPort {
  /**
   * El más nuevo del registro en la empresa con una de esas acciones (desempate por id), o
   * `null`. Usa el índice `eventos_empresa_entidad_idx`.
   */
  ultimoDe(busqueda: BusquedaUltimoEvento): Promise<UltimoEvento | null>;
  /** Agrega el evento (la tabla solo acepta agregar). Se une a la transacción en curso. */
  guardar(evento: EventoAuditoria): Promise<void>;
  /** Los de la empresa, del más nuevo al más viejo (desempate por id), y el total. */
  listar(
    empresaId: string,
    filtros: FiltrosEventos,
    pedido: PedidoPagina,
  ): Promise<{ elementos: EventoResumenGuardado[]; total: number }>;
  /**
   * Quienes hicieron algo en la empresa (los eventos con usuario), por nombre de usuario. Salta
   * por el índice `eventos_empresa_usuario_idx` (uno por persona), sin recorrer la tabla.
   */
  usuariosDe(empresaId: string): Promise<UsuarioDeBitacora[]>;
  /** `null` si no existe o es de otra empresa. */
  buscarPorId(id: string, empresaId: string): Promise<EventoAuditoriaGuardado | null>;
}
