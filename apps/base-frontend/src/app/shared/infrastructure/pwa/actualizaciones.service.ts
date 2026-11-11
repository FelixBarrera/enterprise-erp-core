import { DOCUMENT } from '@angular/common';
import { ApplicationRef, DestroyRef, inject, Injectable, InjectionToken } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { ConfirmacionService } from '../avisos/confirmacion.service';
import { MARCA } from '../layout/marca/marca';
import { NotificacionesService } from '../avisos/notificaciones.service';

/** Cada cuánto se busca una versión nueva con la pestaña abierta (además de al abrir la página). */
export const INTERVALO_BUSCAR_VERSION_MS = 60 * 60 * 1000;

/** Recarga la página. Es un token para poder reemplazarlo en las pruebas. */
export const RECARGAR_PAGINA = new InjectionToken<() => void>('RECARGAR_PAGINA', {
  providedIn: 'root',
  factory: () => {
    const documento = inject(DOCUMENT);
    return () => documento.location.reload();
  },
});

/**
 * Avisa cuando hay una versión nueva de la aplicación (docs/arquitectura-frontend.md, sección 7).
 *
 * - Versión nueva lista: pregunta antes de recargar (la persona puede estar llenando algo).
 *   Si dice que no, la versión nueva entra sola la próxima vez que abra la página.
 * - El service worker quedó en un estado que no puede arreglar: avisa y recarga.
 *
 * Sin service worker (desarrollo, pruebas, navegador sin soporte) no hace nada.
 * Se arranca una vez, desde `app.config.ts`.
 */
@Injectable({ providedIn: 'root' })
export class ActualizacionesService {
  private readonly sw = inject(SwUpdate);
  private readonly app = inject(ApplicationRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly avisos = inject(NotificacionesService);
  private readonly recargar = inject(RECARGAR_PAGINA);
  private preguntando = false;

  iniciar(): void {
    if (!this.sw.isEnabled) return;

    const versionLista = this.sw.versionUpdates
      .pipe(filter((evento) => evento.type === 'VERSION_READY'))
      .subscribe(() => void this.ofrecerActualizar());
    const sinArreglo = this.sw.unrecoverable.subscribe(() => void this.recargarPorFalla());

    // Se espera a que la aplicación esté estable: un temporizador antes no la deja registrarse.
    let temporizador: ReturnType<typeof setInterval> | undefined;
    void this.app.whenStable().then(() => {
      temporizador = setInterval(() => void this.buscarVersion(), INTERVALO_BUSCAR_VERSION_MS);
    });

    this.destroyRef.onDestroy(() => {
      versionLista.unsubscribe();
      sinArreglo.unsubscribe();
      clearInterval(temporizador);
    });
  }

  private async buscarVersion(): Promise<void> {
    try {
      await this.sw.checkForUpdate();
    } catch {
      // Sin conexión o el servidor no respondió: se vuelve a intentar en el próximo intervalo.
    }
  }

  private async ofrecerActualizar(): Promise<void> {
    if (this.preguntando) return;
    this.preguntando = true;
    try {
      const actualizar = await this.confirmacion.confirmar({
        titulo: `Hay una versión nueva de ${MARCA.nombre}`,
        mensaje: 'Para usarla se recarga la página. Lo que no haya guardado se pierde.',
        textoConfirmar: 'Actualizar',
      });
      if (actualizar) this.recargar();
    } finally {
      this.preguntando = false;
    }
  }

  private async recargarPorFalla(): Promise<void> {
    await this.avisos.error('La aplicación necesita recargarse para seguir funcionando.');
    this.recargar();
  }
}
