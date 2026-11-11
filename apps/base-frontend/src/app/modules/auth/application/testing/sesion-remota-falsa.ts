import type { CambioContrasena, Credenciales, Sesion, TokenAcceso } from '../../domain/sesion';
import type { SesionRemotaPort } from '../ports/out/sesion-remota.port';
import { sesionDePrueba, tokenDePrueba } from './sesion-de-prueba';

/** Un backend de mentira para los casos de uso: anota lo que se le pidió. */
export class SesionRemotaFalsa implements SesionRemotaPort {
  readonly llamadas: string[] = [];
  tokenDelLogin: TokenAcceso = tokenDePrueba('del-login');
  tokenDelRefresh: TokenAcceso | null = tokenDePrueba('del-refresh');
  sesion: Sesion = sesionDePrueba();
  errorAlEntrar: unknown = null;
  errorAlRenovar: unknown = null;
  errorAlCerrar: unknown = null;
  errorAlCambiarContrasena: unknown = null;
  errorAlCambiarEmpresa: unknown = null;
  /** Los cambios de contraseña pedidos. */
  readonly cambios: CambioContrasena[] = [];
  /** Con qué token se consultó la sesión. */
  consultadaCon: TokenAcceso | null = null;

  iniciar(credenciales: Credenciales): Promise<TokenAcceso> {
    this.llamadas.push(`iniciar:${credenciales.nombreUsuario}`);
    if (this.errorAlEntrar !== null) return Promise.reject(this.errorAlEntrar);
    return Promise.resolve(this.tokenDelLogin);
  }

  renovar(): Promise<TokenAcceso | null> {
    this.llamadas.push('renovar');
    if (this.errorAlRenovar !== null) return Promise.reject(this.errorAlRenovar);
    return Promise.resolve(this.tokenDelRefresh);
  }

  consultar(token: TokenAcceso): Promise<Sesion> {
    this.llamadas.push('consultar');
    this.consultadaCon = token;
    return Promise.resolve(this.sesion);
  }

  cerrar(): Promise<void> {
    this.llamadas.push('cerrar');
    if (this.errorAlCerrar !== null) return Promise.reject(this.errorAlCerrar);
    return Promise.resolve();
  }

  cambiarContrasena(cambio: CambioContrasena): Promise<void> {
    this.llamadas.push('cambiarContrasena');
    this.cambios.push(cambio);
    if (this.errorAlCambiarContrasena !== null) {
      return Promise.reject(this.errorAlCambiarContrasena);
    }
    return Promise.resolve();
  }

  cambiarEmpresa(empresaId: string): Promise<Sesion> {
    this.llamadas.push(`cambiarEmpresa:${empresaId}`);
    if (this.errorAlCambiarEmpresa !== null) return Promise.reject(this.errorAlCambiarEmpresa);
    return Promise.resolve(this.sesion);
  }
}
