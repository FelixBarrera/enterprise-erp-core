/** Por qué se cerró una sesión (el mismo enum está en la base: `seguridad.motivo_cierre_sesion`). */
export const MotivoCierreSesion = {
  SALIDA: 'SALIDA',
  CAMBIO_CONTRASENA: 'CAMBIO_CONTRASENA',
  REUSO: 'REUSO',
  ADMINISTRADOR: 'ADMINISTRADOR',
  USUARIO_DESACTIVADO: 'USUARIO_DESACTIVADO',
  EMPRESA_DESACTIVADA: 'EMPRESA_DESACTIVADA',
  ACCESO_QUITADO: 'ACCESO_QUITADO',
} as const;
export type MotivoCierreSesion = (typeof MotivoCierreSesion)[keyof typeof MotivoCierreSesion];

/**
 * Cuánto vale el refresh token anterior después de rotar (AUTH-D7): si se perdió la respuesta
 * del refresh, la pantalla reintenta con el que tenía.
 */
export const SEGUNDOS_DE_GRACIA_REFRESH = 60;

/** Qué secreto presentó quien pide renovar la sesión. */
export const SecretoPresentado = {
  /** El vigente: se rota normalmente. */
  VIGENTE: 'VIGENTE',
  /** El anterior, dentro de los 60 s de gracia: se rota igual. */
  ANTERIOR: 'ANTERIOR',
  /** Uno viejo (o inventado): reuso, se cierran todas las sesiones del usuario. */
  DESCONOCIDO: 'DESCONOCIDO',
} as const;
export type SecretoPresentado = (typeof SecretoPresentado)[keyof typeof SecretoPresentado];

/** Lo que se guarda de una sesión (`seguridad.sesiones`). */
export interface DatosSesion {
  readonly id: string;
  readonly usuarioId: string;
  /** La empresa activa (AUTH-D5). */
  readonly empresaId: string;
  /** SHA-256 (hex) del secreto vigente del refresh token. */
  readonly hashRefresh: string;
  readonly hashRefreshAnterior: string | null;
  readonly rotadoEn: Date | null;
  readonly iniciadaEn: Date;
  readonly venceEn: Date;
  readonly ultimoUsoEn: Date;
  readonly cerradaEn: Date | null;
  readonly motivoCierre: MotivoCierreSesion | null;
  readonly ip: string | null;
  readonly navegador: string | null;
}

/**
 * Un ingreso de un usuario: dura como mucho una jornada (`vence_en`) y se corta si nadie la
 * usa (`ultimo_uso_en`, que se mueve en cada refresh: AUTH-D8). Inmutable: cada cambio
 * devuelve otra `Sesion`. La hora la pasa quien llama (`RELOJ_PORT`).
 */
export class Sesion {
  private constructor(private readonly d: DatosSesion) {}

  static reconstruir(datos: DatosSesion): Sesion {
    return new Sesion(datos);
  }

  /** Cuándo vence una sesión que empieza ahora: `SESION_DURACION_MAXIMA_HORAS` después. */
  static vencimiento(iniciadaEn: Date, duracionMaximaHoras: number): Date {
    return new Date(iniciadaEn.getTime() + duracionMaximaHoras * 3_600_000);
  }

  get id(): string {
    return this.d.id;
  }

  get usuarioId(): string {
    return this.d.usuarioId;
  }

  get empresaId(): string {
    return this.d.empresaId;
  }

  get venceEn(): Date {
    return this.d.venceEn;
  }

  datos(): DatosSesion {
    return this.d;
  }

  estaAbierta(): boolean {
    return this.d.cerradaEn === null;
  }

  /**
   * Abierta, sin pasar su vencimiento y usada hace menos de `inactividadMinutos`. Justo en el
   * límite ya no vale.
   */
  estaViva(ahora: Date, inactividadMinutos: number): boolean {
    const instante = ahora.getTime();
    return (
      this.estaAbierta() &&
      instante < this.d.venceEn.getTime() &&
      instante - this.d.ultimoUsoEn.getTime() < inactividadMinutos * 60_000
    );
  }

  /**
   * Compara la huella (SHA-256) del secreto que llegó con las guardadas. El anterior solo vale
   * hasta 60 s después de rotar (inclusive); después cuenta como desconocido (AUTH-D7).
   */
  reconocerSecreto(huella: string, ahora: Date): SecretoPresentado {
    if (huella === this.d.hashRefresh) {
      return SecretoPresentado.VIGENTE;
    }
    const { hashRefreshAnterior, rotadoEn } = this.d;
    if (
      hashRefreshAnterior !== null &&
      rotadoEn !== null &&
      huella === hashRefreshAnterior &&
      ahora.getTime() - rotadoEn.getTime() <= SEGUNDOS_DE_GRACIA_REFRESH * 1000
    ) {
      return SecretoPresentado.ANTERIOR;
    }
    return SecretoPresentado.DESCONOCIDO;
  }

  /** Secreto nuevo: el vigente pasa a ser el anterior (60 s de gracia) y cuenta como uso. */
  rotar(huellaNueva: string, ahora: Date): Sesion {
    return new Sesion({
      ...this.d,
      hashRefresh: huellaNueva,
      hashRefreshAnterior: this.d.hashRefresh,
      rotadoEn: ahora,
      ultimoUsoEn: ahora,
    });
  }

  /** Pasa a trabajar en otra empresa (AUTH-D5): el mismo token sigue sirviendo. */
  cambiarEmpresa(empresaId: string): Sesion {
    return new Sesion({ ...this.d, empresaId });
  }

  /** Cerrada para siempre. Si ya estaba cerrada, queda como estaba (con su motivo). */
  cerrar(motivo: MotivoCierreSesion, ahora: Date): Sesion {
    if (!this.estaAbierta()) {
      return this;
    }
    return new Sesion({ ...this.d, cerradaEn: ahora, motivoCierre: motivo });
  }
}
