import type { Huella } from '../../../../auditoria/application/ports/in/consultar-trazabilidad.port.js';
import type { Actor } from '../../../../../shared/application/actor.js';
import type { Pagina, PedidoPagina } from '../../../../../shared/application/pagina.js';
import type { FiltrosUsuarios } from '../out/usuarios.repository.port.js';

export const CONSULTAR_USUARIOS_PORT = Symbol('CONSULTAR_USUARIOS_PORT');

/** Un rol del usuario en la empresa activa. */
export interface RolDeUsuarioVista {
  readonly id: string;
  readonly nombre: string;
  readonly esAdministrador: boolean;
  /** Un rol desactivado no da permisos (la asignación queda). */
  readonly activo: boolean;
}

/** Una fila de la lista de usuarios. */
export interface UsuarioResumenVista {
  readonly id: string;
  readonly nombreUsuario: string;
  readonly nombreCompleto: string;
  readonly activo: boolean;
  /** Hasta cuándo está bloqueado por intentos fallidos; `null` si no lo está ahora. */
  readonly bloqueadoHasta: Date | null;
  readonly ultimoIngresoEn: Date | null;
  /** Tiene una contraseña temporal que todavía no cambió (AUTH-D13). */
  readonly debeCambiarContrasena: boolean;
  /** Sus roles en la empresa activa, por nombre. */
  readonly roles: readonly RolDeUsuarioVista[];
}

/** Una sesión abierta del usuario en la empresa activa. */
export interface SesionAbiertaVista {
  readonly id: string;
  readonly iniciadaEn: Date;
  readonly ultimoUsoEn: Date;
  readonly ip: string | null;
  readonly navegador: string | null;
}

/** La ficha de un usuario, vista desde la empresa activa. */
export interface UsuarioVista extends UsuarioResumenVista {
  /**
   * Tiene roles en otra empresa activa (sin decir cuál: decisión del usuario, 6.7c). Lo que es
   * de la persona solo lo cambia quien lo administra en todas (AUTH-D12).
   */
  readonly trabajaEnOtrasEmpresas: boolean;
  /** Sus sesiones vivas **en la empresa activa** (decisión del usuario, 6.7c). */
  readonly sesiones: readonly SesionAbiertaVista[];
  /**
   * Cuándo entró a la empresa (lo crearon o le dieron acceso en ella) y quién, de la bitácora de
   * la empresa activa: nunca alguien de otra. `null` si no consta.
   */
  readonly creado: Huella | null;
  /** El último cambio hecho por una persona en esta empresa después de eso; no cuentan los ingresos. */
  readonly modificado: Huella | null;
}

/** Un rol activo de la empresa, para elegir los roles de un usuario (6.12b0). */
export interface RolAsignableVista {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly esAdministrador: boolean;
  /**
   * Quien consulta lo puede dar (AUTH-D11 (2) y (3)): lo mismo que revisa la API al guardar. Uno
   * que no, la pantalla lo muestra bloqueado.
   */
  readonly sePuedeDar: boolean;
}

/**
 * `GET /usuarios`, `GET /usuarios/roles-asignables` y `GET /usuarios/:id`: siempre los de la empresa activa de quien consulta (los
 * que tienen algún rol en ella).
 */
export interface ConsultarUsuariosPort {
  listar(
    filtros: FiltrosUsuarios,
    pedido: PedidoPagina,
    actor: Actor,
  ): Promise<Pagina<UsuarioResumenVista>>;
  /**
   * Los roles activos de la empresa activa (el Administrador primero, luego por nombre), cada uno
   * con `sePuedeDar` según quien consulta. Un rol desactivado no sale: no se da (6.7d).
   */
  rolesAsignables(actor: Actor): Promise<RolAsignableVista[]>;
  /** `UsuarioNoEncontradoError` si no tiene ningún rol en la empresa activa. */
  ver(id: string, actor: Actor): Promise<UsuarioVista>;
}
