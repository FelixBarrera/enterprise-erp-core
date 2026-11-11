import { computed, Injectable, signal } from '@angular/core';
import type { Sesion, SesionAbierta, TokenAcceso } from '../../../domain/sesion';

/**
 * La sesión de esta pestaña. El access token vive **solo aquí, en memoria** (nunca en
 * `localStorage` ni `sessionStorage`): al recargar se pide otro con la cookie.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _token = signal<TokenAcceso | null>(null);
  private readonly _sesion = signal<Sesion | null>(null);

  readonly token = computed(() => this._token()?.valor ?? null);
  readonly sesion = this._sesion.asReadonly();
  /** El token y la sesión juntos (para pasárselos a otra pestaña); `null` sin sesión. */
  readonly abierta = computed<SesionAbierta | null>(() => {
    const token = this._token();
    const sesion = this._sesion();
    return token === null || sesion === null ? null : { token, sesion };
  });
  readonly autenticado = computed(() => this.abierta() !== null);
  readonly nombreCompleto = computed(() => this._sesion()?.usuario.nombreCompleto ?? null);
  readonly nombreUsuario = computed(() => this._sesion()?.usuario.nombreUsuario ?? null);
  readonly nombreEmpresa = computed(() => this._sesion()?.empresaActiva.nombre ?? null);
  readonly empresaActivaId = computed(() => this._sesion()?.empresaActiva.id ?? null);
  /** Todas en las que puede trabajar, por nombre (vacía sin sesión). */
  readonly empresas = computed(() => this._sesion()?.empresas ?? []);
  readonly esAdministrador = computed(() => this._sesion()?.esAdministrador ?? false);
  /** Entró con una contraseña temporal: lo primero es cambiarla (AUTH-D14). */
  readonly debeCambiarContrasena = computed(
    () => this._sesion()?.usuario.debeCambiarContrasena ?? false,
  );

  fijar(abierta: SesionAbierta): void {
    this._token.set(abierta.token);
    this._sesion.set(abierta.sesion);
  }

  /** Cambia los datos de la sesión y deja el mismo token (por ejemplo, al cambiar la contraseña). */
  actualizarSesion(sesion: Sesion): void {
    this._sesion.set(sesion);
  }

  limpiar(): void {
    this._token.set(null);
    this._sesion.set(null);
  }
}
