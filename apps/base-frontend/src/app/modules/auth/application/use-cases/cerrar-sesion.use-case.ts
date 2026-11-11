import { inject, Injectable } from '@angular/core';
import { ErrorHttp, TipoErrorHttp } from '../../../../shared/domain/errors/error-http';
import type { CerrarSesionPort } from '../ports/in/cerrar-sesion.port';
import { DATOS_LOCALES_PORT } from '../ports/out/datos-locales.port';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';

/**
 * Cierra la sesión en el backend y borra lo guardado en el navegador. Si el backend dice que la
 * sesión ya había terminado (401), es lo mismo que haberla cerrado. Cualquier otro error (sin
 * conexión) se lanza y la sesión se mantiene (docs/arquitectura-frontend.md, sección 6).
 */
@Injectable()
export class CerrarSesionUseCase implements CerrarSesionPort {
  private readonly remota = inject(SESION_REMOTA_PORT);
  private readonly datosLocales = inject(DATOS_LOCALES_PORT);

  async execute(): Promise<void> {
    try {
      await this.remota.cerrar();
    } catch (error) {
      if (!(error instanceof ErrorHttp && error.tipo === TipoErrorHttp.NO_AUTENTICADO)) throw error;
    }
    await this.datosLocales.borrar();
  }
}
