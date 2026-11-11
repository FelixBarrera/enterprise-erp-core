import type { DialogConfig, DialogRef } from '@angular/cdk/dialog';
import type { Injector, Type } from '@angular/core';

/**
 * Abre un diálogo del CDK cargando su código **recién la primera vez que hace falta**
 * (con `import()`): así no pesa en el paquete inicial (regla 12 de docs/arquitectura-frontend.md).
 */
export async function abrirDialogo<R, D, C>(
  injector: Injector,
  cargarComponente: () => Promise<Type<C>>,
  config: DialogConfig<D, DialogRef<R, C>>,
): Promise<DialogRef<R, C>> {
  const [{ Dialog }, componente] = await Promise.all([
    import('@angular/cdk/dialog'),
    cargarComponente(),
  ]);
  return injector.get(Dialog).open<R, D, C>(componente, config);
}

let contador = 0;

/** Id único para enlazar el diálogo con su título y su texto (`aria-labelledby`, `aria-describedby`). */
export function idUnico(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${contador}`;
}
