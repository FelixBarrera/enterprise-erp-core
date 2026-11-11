import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, Injectable, Injector } from '@angular/core';
import { abrirDialogo, idUnico } from '../../avisos/abrir-dialogo';
import { PANTALLA_CHICA } from '../pantalla-chica';
import type { DatosSelectorEmpresa } from './selector-empresa.component';

/**
 * Abre «Cambiar de empresa»: en la PC, una ventana al centro; en el celular, la misma lista
 * subiendo desde abajo (pantalla 4 de la maqueta aprobada). El código se descarga recién la
 * primera vez que se abre.
 */
@Injectable({ providedIn: 'root' })
export class SelectorEmpresaService {
  private readonly injector = inject(Injector);
  private readonly pantalla = inject(BreakpointObserver);

  async abrir(): Promise<void> {
    const enCelular = this.pantalla.isMatched(PANTALLA_CHICA);
    const datos: DatosSelectorEmpresa = {
      enCelular,
      idTitulo: idUnico('selector-empresa-titulo'),
      idTexto: idUnico('selector-empresa-texto'),
    };
    await abrirDialogo<void, DatosSelectorEmpresa, unknown>(
      this.injector,
      () => import('./selector-empresa.component').then((m) => m.SelectorEmpresaComponent),
      {
        data: datos,
        ariaLabelledBy: datos.idTitulo,
        ariaDescribedBy: datos.idTexto,
        ariaModal: true,
        // El foco empieza en la empresa activa; con Tab, a las demás.
        autoFocus: '[aria-current="true"]',
        // En el celular, `panel-hoja` la pega abajo (styles.scss). Con la posición del overlay del
        // CDK habría que importarlo entero: sumaba 31 kB al paquete inicial.
        ...(enCelular
          ? { width: '100%', maxWidth: '100%', panelClass: ['panel-aviso', 'panel-hoja'] }
          : { width: '440px', maxWidth: 'calc(100vw - 32px)', panelClass: 'panel-aviso' }),
      },
    );
  }
}
