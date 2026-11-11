import { Injectable, type OnDestroy } from '@angular/core';
import type { SesionAbierta } from '../../../../domain/sesion';

/** Lo que una pestaña le cuenta a las demás. */
export type MensajePestanas =
  | { readonly tipo: 'renovada'; readonly sesion: SesionAbierta }
  | { readonly tipo: 'terminada' }
  | { readonly tipo: 'empresa-cambiada' };

/**
 * Coordina las pestañas abiertas (docs/arquitectura-frontend.md, sección 6): **una sola renueva a
 * la vez** (Web Locks: un candado del navegador) y avisa a las demás (`BroadcastChannel`: un canal
 * entre pestañas de este sitio). Dos pestañas renovando a la vez con la misma cookie parecen un
 * robo para el backend.
 *
 * Si el navegador no tiene alguna de las dos (o la página no se abrió con HTTPS ni en `localhost`),
 * se trabaja sin ella: cada pestaña renueva por su cuenta, igual dentro de los 60 s de gracia.
 */
@Injectable({ providedIn: 'root' })
export class Pestanas implements OnDestroy {
  private readonly canal =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('sesion');

  /** Corre `tarea` con el candado de la renovación: si otra pestaña lo tiene, espera su turno. */
  conCandado<T>(tarea: () => Promise<T>): Promise<T> {
    if (typeof navigator === 'undefined' || !('locks' in navigator)) return tarea();
    return navigator.locks.request('renovar-sesion', tarea);
  }

  avisar(mensaje: MensajePestanas): void {
    this.canal?.postMessage(mensaje);
  }

  alRecibir(oyente: (mensaje: MensajePestanas) => void): void {
    this.canal?.addEventListener('message', (evento: MessageEvent<unknown>) => {
      if (esMensaje(evento.data)) oyente(evento.data);
    });
  }

  ngOnDestroy(): void {
    this.canal?.close();
  }
}

/** Viene de otra pestaña de este mismo sitio, pero se revisa la forma: es un borde. */
function esMensaje(dato: unknown): dato is MensajePestanas {
  if (typeof dato !== 'object' || dato === null || !('tipo' in dato)) return false;
  if (dato.tipo === 'terminada' || dato.tipo === 'empresa-cambiada') return true;
  return (
    dato.tipo === 'renovada' &&
    'sesion' in dato &&
    typeof dato.sesion === 'object' &&
    dato.sesion !== null &&
    'token' in dato.sesion &&
    'sesion' in dato.sesion
  );
}
