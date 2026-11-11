import type { MotivoCierreSesion, Sesion } from '../../../domain/entities/sesion.entity.js';

export const SESIONES_REPOSITORY_PORT = Symbol('SESIONES_REPOSITORY_PORT');

export interface NuevaSesion {
  readonly usuarioId: string;
  readonly empresaId: string;
  readonly hashRefresh: string;
  readonly iniciadaEn: Date;
  readonly venceEn: Date;
  readonly ip: string | null;
  readonly navegador: string | null;
}

/** `seguridad.sesiones`. Se une a la transacción en curso. */
export interface SesionesRepositoryPort {
  /** La crea abierta, con `ultimo_uso_en` = `iniciada_en`. El id lo pone la base (UUID v7). */
  crear(nueva: NuevaSesion): Promise<Sesion>;
  /** La sesión, sin bloquear nada (solo para leer). `null` si no existe. */
  buscarPorId(id: string): Promise<Sesion | null>;
  /**
   * La sesión, bloqueando su fila hasta el final de la transacción (`FOR UPDATE`): dos refresh
   * a la vez con el mismo token se atienden uno detrás del otro. `null` si no existe.
   */
  buscarParaActualizar(id: string): Promise<Sesion | null>;
  /**
   * Las que no se cerraron, del usuario en esa empresa, la usada más hace poco primero. Pueden
   * estar vencidas: lo decide quien llama (`Sesion.estaViva()`).
   */
  abiertasDeUsuarioEnEmpresa(usuarioId: string, empresaId: string): Promise<Sesion[]>;
  /** Guarda lo que cambia (secretos, uso, empresa, cierre). */
  guardar(sesion: Sesion): Promise<void>;
  /** Cierra todas las abiertas del usuario con ese motivo; devuelve cuántas cerró. */
  cerrarTodasDelUsuario(
    usuarioId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number>;
  /**
   * Cierra las abiertas del usuario **menos** `exceptoSesionId` (cambio de contraseña: la sesión
   * desde la que se cambió sigue); devuelve cuántas cerró.
   */
  cerrarOtrasDelUsuario(
    usuarioId: string,
    exceptoSesionId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number>;
  /**
   * Cierra las abiertas del usuario **en esa empresa** (quitarle el acceso); devuelve cuántas
   * cerró. Las de otras empresas siguen.
   */
  cerrarTodasDelUsuarioEnEmpresa(
    usuarioId: string,
    empresaId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number>;
  /** Cierra todas las abiertas en esa empresa (de todos sus usuarios); devuelve cuántas cerró. */
  cerrarTodasDeEmpresa(empresaId: string, motivo: MotivoCierreSesion, ahora: Date): Promise<number>;
}
