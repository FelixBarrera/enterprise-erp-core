export const CONSULTAR_SESION_PORT = Symbol('CONSULTAR_SESION_PORT');

export interface EmpresaDeSesion {
  readonly id: string;
  readonly nombre: string;
}

/** `GET /auth/sesion`: lo que la pantalla necesita saber de quien entró (FS-01). */
export interface SesionVista {
  readonly usuario: {
    readonly id: string;
    readonly nombreUsuario: string;
    readonly nombreCompleto: string;
    readonly debeCambiarContrasena: boolean;
  };
  readonly empresaActiva: EmpresaDeSesion;
  /** Todas en las que puede trabajar, por nombre (el selector se muestra si hay más de una). */
  readonly empresas: readonly EmpresaDeSesion[];
  readonly esAdministrador: boolean;
  /**
   * Sus permisos vigentes en la empresa activa, por código (6.6a): los de sus roles activos; el
   * Administrador, todos.
   */
  readonly permisos: readonly string[];
  /** `ZONA_NEGOCIO`: la pantalla muestra las fechas en esta zona (decisión del 6.2). */
  readonly zonaNegocio: string;
  /** Hasta cuándo dura la sesión como mucho (`SESION_DURACION_MAXIMA_HORAS`). */
  readonly sesionVenceEn: Date;
}

export interface ConsultarSesionComando {
  readonly sesionId: string;
  readonly usuarioId: string;
  readonly empresaId: string;
  readonly esAdministrador: boolean;
}

/** Arma la vista de la sesión ya revisada por el guard. */
export interface ConsultarSesionPort {
  execute(comando: ConsultarSesionComando): Promise<SesionVista>;
}
