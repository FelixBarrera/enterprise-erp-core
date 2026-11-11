import { FormControl } from '@angular/forms';
import { obligatorio } from './validadores';

describe('obligatorio', () => {
  it.each([[null], [undefined], [''], ['   ']])('%j es un error', (valor) => {
    expect(obligatorio(new FormControl<unknown>(valor))).toEqual({ obligatorio: true });
  });

  it.each([['ana'], [' ana '], [0], [false]])('%j está bien', (valor) => {
    expect(obligatorio(new FormControl<unknown>(valor))).toBeNull();
  });
});
