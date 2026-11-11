import { InjectionToken, type Signal } from '@angular/core';

/** Una de las empresas en las que trabaja la persona. */
export interface EmpresaCabecera {
  readonly id: string;
  readonly nombre: string;
}

/**
 * Quién está trabajando y en qué empresa, cambiar de empresa o de contraseña y salir, para la
 * cabecera y el menú lateral. Lo entrega el módulo `auth` desde `app.config.ts` (shared/ no conoce
 * los módulos). Sin sesión, los textos son `null` y la lista de empresas está vacía.
 */
export interface UsuarioCabecera {
  /** «Ana Pérez». */
  readonly nombreCompleto: Signal<string | null>;
  /** El usuario con el que entra: «ana.perez». */
  readonly nombreUsuario: Signal<string | null>;
  /** Empresa activa. */
  readonly nombreEmpresa: Signal<string | null>;
  readonly empresaActivaId: Signal<string | null>;
  /** Todas en las que puede trabajar, por nombre (la activa también). */
  readonly empresas: Signal<readonly EmpresaCabecera[]>;
  /** Tiene el rol Administrador en la empresa activa (se muestra debajo del nombre). */
  readonly esAdministrador: Signal<boolean>;
  /**
   * Pasa a otra de sus empresas y recarga la página en el inicio. Si falla, lanza (ya avisado) y
   * todo sigue como estaba.
   */
  cambiarEmpresa(empresaId: string): Promise<void>;
  /** Lleva a «Cambiar contraseña» y, al terminar, vuelve a la pantalla en la que estaba. */
  irACambiarContrasena(): Promise<void>;
  /** Cierra la sesión y recarga en el login. Si falla, lanza y la sesión sigue (ya avisado). */
  salir(): Promise<void>;
}

export const USUARIO_CABECERA = new InjectionToken<UsuarioCabecera>('USUARIO_CABECERA');
