import type { Actor } from '../../../../../shared/application/actor.js';
import type { Pagina, PedidoPagina } from '../../../../../shared/application/pagina.js';
import type { CambiosJson } from '../../../domain/evento-auditoria.js';

export const CONSULTAR_AUDITORIA_PORT = Symbol('CONSULTAR_AUDITORIA_PORT');

/**
 * Los filtros de `GET /auditoria/eventos`. Las fechas son días del negocio (`aaaa-mm-dd`):
 * obligatorias y hasta 92 días, salvo en la historia de un registro (`entidad` + `entidadId`),
 * donde son opcionales y sin tope (6.12c0b).
 */
export interface FiltrosConsultaAuditoria {
  readonly desde?: string;
  readonly hasta?: string;
  readonly usuarioId?: string;
  /** Una acción (`auth.usuario.crear`) o un grupo (`auth.usuario`, `auth`). */
  readonly accion?: string;
  /** El tipo de registro (`usuario`); con `entidadId`, ese registro. */
  readonly entidad?: string;
  readonly entidadId?: string;
}

/** Una fila de la lista: sin `antes` ni `despues` (están en el detalle). */
export interface EventoResumenVista {
  readonly id: string;
  readonly ocurridoEn: Date;
  readonly usuarioId: string | null;
  /** Como se llamaba cuando lo hizo (AUD-D2). */
  readonly nombreUsuario: string | null;
  readonly accion: string;
  readonly entidad: string | null;
  readonly entidadId: string | null;
  /** Cómo se llamaba el registro en ese momento (6.12c0b; `null` en los de antes). */
  readonly entidadNombre: string | null;
}

/** Alguien que aparece en la bitácora de la empresa: una opción del filtro «Usuario». */
export interface UsuarioDeBitacoraVista {
  readonly usuarioId: string;
  readonly nombreUsuario: string;
}

/** Un evento completo. */
export interface EventoVista extends EventoResumenVista {
  readonly antes: CambiosJson | null;
  readonly despues: CambiosJson | null;
  readonly ip: string | null;
  readonly navegador: string | null;
  readonly requestId: string | null;
}

/**
 * La bitácora de la empresa activa de quien consulta (AUD-D5), del más nuevo al más viejo.
 * Consultarla no se registra en la bitácora (queda en el log del servidor).
 */
export interface ConsultarAuditoriaPort {
  /**
   * `RangoFechasInvalidoError` si faltan las fechas, están al revés o pasan de 92 días (la
   * historia de un registro solo revisa que no estén al revés).
   */
  listar(
    filtros: FiltrosConsultaAuditoria,
    pedido: PedidoPagina,
    actor: Actor,
  ): Promise<Pagina<EventoResumenVista>>;
  /**
   * Quienes hicieron algo en la empresa activa, en toda su historia (también quien ya no tiene
   * acceso), por nombre de usuario: las opciones del filtro «Usuario» (6.12c0). Solo de la propia
   * bitácora: no pide «Ver usuarios».
   */
  usuarios(actor: Actor): Promise<UsuarioDeBitacoraVista[]>;
  /** `EventoNoEncontradoError` si no existe en la empresa activa. */
  ver(id: string, actor: Actor): Promise<EventoVista>;
}
