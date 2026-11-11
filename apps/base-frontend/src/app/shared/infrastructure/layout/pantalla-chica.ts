import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Celular y tablet (hasta 959 px): el menú se despliega encima del contenido. */
export const PANTALLA_CHICA = '(max-width: 959.98px)';

/** Celular (hasta 599 px): las listas pasan de tabla a tarjetas (docs/arquitectura-frontend.md, 4). */
export const CELULAR = '(max-width: 599.98px)';

/**
 * `true` mientras la pantalla cumple la consulta (cambia al girar o al agrandar la ventana). Se
 * llama en el constructor o al declarar un campo: `protected readonly enCelular = segunPantalla(CELULAR);`
 */
export function segunPantalla(consulta: string): Signal<boolean> {
  const pantalla = inject(BreakpointObserver);
  return toSignal(pantalla.observe(consulta).pipe(map((estado) => estado.matches)), {
    initialValue: pantalla.isMatched(consulta),
  });
}
