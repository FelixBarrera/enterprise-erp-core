import { inject, Injectable } from '@angular/core';
import type { Sesion } from '../../domain/sesion';
import type { CambiarEmpresaPort } from '../ports/in/cambiar-empresa.port';
import { DATOS_LOCALES_PORT } from '../ports/out/datos-locales.port';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';

/**
 * Cambia de empresa: el backend pasa la sesión a la otra (el mismo token sigue sirviendo) y aquí
 * se borra lo que el navegador guardó de la anterior, para que nada de ella quede a la vista. Si
 * el backend la rechaza, no se borra nada: se sigue en la misma empresa.
 */
@Injectable()
export class CambiarEmpresaUseCase implements CambiarEmpresaPort {
  private readonly remota = inject(SESION_REMOTA_PORT);
  private readonly datosLocales = inject(DATOS_LOCALES_PORT);

  async execute(empresaId: string): Promise<Sesion> {
    const sesion = await this.remota.cambiarEmpresa(empresaId);
    await this.datosLocales.borrar();
    return sesion;
  }
}
