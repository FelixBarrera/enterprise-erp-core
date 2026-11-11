import { FormControl } from '@angular/forms';
import { obligatorio } from '../formularios/validadores';
import { ErrorAlTocar } from './error-al-tocar';

describe('ErrorAlTocar', () => {
  const matcher = new ErrorAlTocar();

  it('un campo mal y tocado muestra su error', () => {
    const control = new FormControl('', { validators: [obligatorio] });
    control.markAsTouched();
    expect(matcher.isErrorState(control)).toBe(true);
  });

  it('sin tocar, o bien, no', () => {
    const control = new FormControl('', { validators: [obligatorio] });
    expect(matcher.isErrorState(control)).toBe(false);
    control.setValue('algo');
    control.markAsTouched();
    expect(matcher.isErrorState(control)).toBe(false);
    expect(matcher.isErrorState(null)).toBe(false);
  });

  it('un campo vaciado con reset vuelve a quedar sin error', () => {
    const control = new FormControl('x', { validators: [obligatorio] });
    control.markAsTouched();
    control.reset('');
    expect(matcher.isErrorState(control)).toBe(false);
  });
});
