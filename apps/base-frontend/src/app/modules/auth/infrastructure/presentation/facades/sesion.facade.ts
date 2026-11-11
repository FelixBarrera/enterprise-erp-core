import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { UsuarioCabecera } from '../../../../../shared/infrastructure/layout/usuario-cabecera';
import type { PermisosSesion } from '../../../../../shared/infrastructure/permisos/permisos-sesion';
import { CAMBIAR_CONTRASENA_PORT } from '../../../application/ports/in/cambiar-contrasena.port';
import { CAMBIAR_EMPRESA_PORT } from '../../../application/ports/in/cambiar-empresa.port';
import { CERRAR_SESION_PORT } from '../../../application/ports/in/cerrar-sesion.port';
import { INICIAR_SESION_PORT } from '../../../application/ports/in/iniciar-sesion.port';
import { RENOVAR_SESION_PORT } from '../../../application/ports/in/renovar-sesion.port';
import {
  DESTINO_POR_DEFECTO,
  destinoTrasIngreso,
  RUTA_CAMBIAR_CONTRASENA,
  RUTA_CONTRASENA_TEMPORAL,
  RUTA_LOGIN,
  volverDesde,
} from '../../../domain/destino-tras-ingreso';
import { type CambioContrasena, type Credenciales, tienePermiso } from '../../../domain/sesion';
import { type MensajePestanas, Pestanas } from '../../adapters/out/navegador/pestanas';
import { Recarga } from '../../adapters/out/navegador/recarga';
import { AuthStore } from '../stores/auth.store';

/**
 * Entrar, renovar, cambiar la contraseña o la empresa y salir: junta los casos de uso, el store, las otras pestañas y la navegación.
 * No captura errores: los ve quien llamó (docs/arquitectura-frontend.md, regla 3).
 */
@Injectable({ providedIn: 'root' })
export class SesionFacade implements UsuarioCabecera, PermisosSesion {
  private readonly iniciarSesion = inject(INICIAR_SESION_PORT);
  private readonly renovarSesion = inject(RENOVAR_SESION_PORT);
  private readonly cerrarSesion = inject(CERRAR_SESION_PORT);
  private readonly cambiarContrasenaUseCase = inject(CAMBIAR_CONTRASENA_PORT);
  private readonly cambiarEmpresaUseCase = inject(CAMBIAR_EMPRESA_PORT);
  private readonly store = inject(AuthStore);
  private readonly pestanas = inject(Pestanas);
  private readonly router = inject(Router);
  private readonly recarga = inject(Recarga);

  readonly sesion = this.store.sesion;
  readonly nombreCompleto = this.store.nombreCompleto;
  readonly nombreUsuario = this.store.nombreUsuario;
  readonly nombreEmpresa = this.store.nombreEmpresa;
  readonly esAdministrador = this.store.esAdministrador;
  readonly empresas = this.store.empresas;
  readonly empresaActivaId = this.store.empresaActivaId;

  /** La renovación en curso en esta pestaña: varios 401 juntos esperan la misma. */
  private renovacionEnCurso: Promise<string | null> | null = null;

  constructor() {
    this.pestanas.alRecibir((mensaje) => this.recibir(mensaje));
  }

  /** Entra y va a la pantalla pedida (`volver`) o al inicio. */
  async entrar(credenciales: Credenciales, volver: string | null): Promise<void> {
    const resultado = await this.iniciarSesion.execute(credenciales);
    this.store.fijar(resultado.sesion);
    await this.router.navigateByUrl(destinoTrasIngreso(volver));
  }

  /**
   * Un token nuevo, o `null` si la sesión terminó (entonces ya quedó limpia y avisada a las otras
   * pestañas). `tokenQueFallo` es el que recibió el 401 (`null` al recargar la página): si otra
   * pestaña ya lo renovó mientras se esperaba el candado, se usa ese sin pedir otro. Sin conexión,
   * lanza y la sesión se mantiene.
   */
  renovar(tokenQueFallo: string | null): Promise<string | null> {
    this.renovacionEnCurso ??= this.pestanas
      .conCandado(() => this.renovarAhora(tokenQueFallo))
      .finally(() => (this.renovacionEnCurso = null));
    return this.renovacionEnCurso;
  }

  /** Por permiso, nunca por rol (lee la sesión: dentro de un `computed`, se actualiza sola). */
  tiene(codigo: string): boolean {
    return tienePermiso(this.store.sesion(), codigo);
  }

  /**
   * `true` si hay sesión para trabajar en esta pestaña o se recupera con la cookie (al recargar la
   * página); `false` sin sesión o con una contraseña temporal. Sin conexión, lanza (ya avisado).
   */
  async sesionLista(): Promise<boolean> {
    if (!this.store.autenticado() && (await this.renovar(null)) === null) return false;
    return !this.store.debeCambiarContrasena();
  }

  /** Al login, para volver después a la pantalla en la que estaba. */
  async irAlLogin(): Promise<void> {
    await this.irConVolver(RUTA_LOGIN);
  }

  /** A «Cambiar contraseña» (la voluntaria), para volver después a la pantalla en la que estaba. */
  async irACambiarContrasena(): Promise<void> {
    await this.irConVolver(RUTA_CAMBIAR_CONTRASENA);
  }

  /**
   * Cambia la contraseña, se lo cuenta a las otras pestañas (la que esperaba en «Elija su
   * contraseña» sigue sola) y va a la pantalla pedida (`volver`) o al inicio.
   */
  async cambiarContrasena(cambio: CambioContrasena, volver: string | null): Promise<void> {
    const sesion = this.store.sesion();
    if (sesion === null) throw new Error('No hay una sesión abierta');
    this.store.actualizarSesion(await this.cambiarContrasenaUseCase.execute(cambio, sesion));
    const abierta = this.store.abierta();
    if (abierta !== null) this.pestanas.avisar({ tipo: 'renovada', sesion: abierta });
    await this.router.navigateByUrl(destinoTrasIngreso(volver));
  }

  /**
   * Pasa a otra de sus empresas y **recarga en el inicio**, igual que las otras pestañas (comparten
   * la sesión): nada de la empresa anterior queda en la memoria ni a la vista. Si ya está en esa,
   * no hace nada. Si el backend la rechaza, lanza (ya avisado) y todo sigue como estaba.
   */
  async cambiarEmpresa(empresaId: string): Promise<void> {
    if (empresaId === this.store.empresaActivaId()) return;
    this.store.actualizarSesion(await this.cambiarEmpresaUseCase.execute(empresaId));
    this.pestanas.avisar({ tipo: 'empresa-cambiada' });
    this.recarga.ir(DESTINO_POR_DEFECTO);
  }

  /** Cierra la sesión, avisa a las otras pestañas y recarga en el login. */
  async salir(): Promise<void> {
    await this.cerrarSesion.execute();
    this.pestanas.avisar({ tipo: 'terminada' });
    this.recarga.ir(RUTA_LOGIN);
  }

  private async renovarAhora(tokenQueFallo: string | null): Promise<string | null> {
    const actual = this.store.token();
    if (actual !== null && actual !== tokenQueFallo) return actual;
    const abierta = await this.renovarSesion.execute();
    if (abierta === null) {
      this.store.limpiar();
      this.pestanas.avisar({ tipo: 'terminada' });
      return null;
    }
    this.store.fijar(abierta);
    this.pestanas.avisar({ tipo: 'renovada', sesion: abierta });
    return abierta.token.valor;
  }

  private recibir(mensaje: MensajePestanas): void {
    if (mensaje.tipo === 'renovada') {
      this.store.fijar(mensaje.sesion);
      this.seguirSiYaNoEsTemporal();
      return;
    }
    if (mensaje.tipo === 'empresa-cambiada') {
      // Otra pestaña cambió de empresa: la sesión es la misma, así que esta también recarga.
      if (this.store.autenticado()) this.recarga.ir(DESTINO_POR_DEFECTO);
      return;
    }
    // Otra pestaña salió o vio terminar la sesión: esta también, recargando en el login.
    if (this.store.autenticado()) {
      this.store.limpiar();
      this.recarga.ir(RUTA_LOGIN);
    }
  }

  /** La contraseña temporal se cambió en otra pestaña: esta deja «Elija su contraseña» y sigue. */
  private seguirSiYaNoEsTemporal(): void {
    if (this.store.debeCambiarContrasena()) return;
    const url = this.router.url;
    if (url !== RUTA_CONTRASENA_TEMPORAL && !url.startsWith(`${RUTA_CONTRASENA_TEMPORAL}?`)) return;
    const volver = this.router.parseUrl(url).queryParamMap.get('volver');
    void this.router.navigateByUrl(destinoTrasIngreso(volver));
  }

  private async irConVolver(ruta: string): Promise<void> {
    const volver = volverDesde(this.router.url);
    await this.router.navigate([ruta], volver === null ? {} : { queryParams: { volver } });
  }
}
