export const CONSULTAR_TRAZABILIDAD_PORT = Symbol('CONSULTAR_TRAZABILIDAD_PORT');

/** Cuándo pasó algo y quién lo hizo (como se llamaba entonces, AUD-D2; `null`: el sistema). */
export interface Huella {
  readonly en: Date;
  readonly por: string | null;
}

/**
 * El pie de una ficha («Creado el … por …», «Modificado el … por …») leído de la bitácora de una
 * empresa: nunca muestra a alguien de otra empresa ni cuenta los cambios que hace el sistema
 * solo (un ingreso), porque solo mira las acciones que se le piden.
 */
export interface ConsultaTrazabilidad {
  readonly empresaId: string;
  /** El tipo de registro (`rol`, `usuario`). */
  readonly entidad: string;
  readonly entidadId: string;
  /** Las que lo dan de alta en la empresa (`auth.rol.crear`); cuenta la última. */
  readonly accionesAlta: readonly string[];
  /** Las que cuentan como un cambio hecho por una persona. */
  readonly accionesCambio: readonly string[];
}

export interface Trazabilidad {
  /** La última alta; `null` si la bitácora no la tiene (un registro anterior a ella). */
  readonly creado: Huella | null;
  /** El último cambio **después** del alta; `null` si no hubo ninguno. */
  readonly modificado: Huella | null;
}

/**
 * Lo usan las fichas de otros módulos (global, como `REGISTRAR_AUDITORIA_PORT`). Dentro de una
 * transacción, ve también el evento que se acaba de registrar en ella.
 */
export interface ConsultarTrazabilidadPort {
  de(consulta: ConsultaTrazabilidad): Promise<Trazabilidad>;
}
