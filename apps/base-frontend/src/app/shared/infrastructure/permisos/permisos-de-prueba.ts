import { signal } from '@angular/core';
import type { PermisosSesion } from './permisos-sesion';

/**
 * Permisos de mentira para las pruebas de pantallas: `permisos.fijar(['x.y.z'])` los cambia y lo
 * que los usa se actualiza (como al renovar la sesión).
 */
export class PermisosDePrueba implements PermisosSesion {
  private readonly codigos = signal<readonly string[]>([]);

  constructor(
    codigos: readonly string[] = [],
    readonly sesionLista: () => Promise<boolean> = () => Promise.resolve(true),
  ) {
    this.codigos.set(codigos);
  }

  tiene(codigo: string): boolean {
    return this.codigos().includes(codigo);
  }

  fijar(codigos: readonly string[]): void {
    this.codigos.set(codigos);
  }
}
