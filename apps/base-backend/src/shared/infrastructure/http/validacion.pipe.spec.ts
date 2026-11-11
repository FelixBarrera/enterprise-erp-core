import type { ValidationError } from '@nestjs/common';
import { primerMensaje } from './validacion.pipe.js';

const error = (parcial: Partial<ValidationError>): ValidationError => ({
  property: 'x',
  children: [],
  ...parcial,
});

describe('primerMensaje', () => {
  it('devuelve el mensaje del decorador', () => {
    expect(primerMensaje([error({ constraints: { isString: 'El nombre debe ser texto' } })])).toBe(
      'El nombre debe ser texto',
    );
  });

  it('traduce el campo no permitido con su ruta', () => {
    const anidado = error({
      property: 'direccion',
      children: [
        error({
          property: 'calle',
          constraints: {
            whitelistValidation: 'property calle should not exist',
          },
        }),
      ],
    });
    expect(primerMensaje([anidado])).toBe('El campo direccion.calle no está permitido');
  });

  it('salta los errores sin mensaje y usa el siguiente', () => {
    expect(primerMensaje([error({}), error({ constraints: { min: 'Mínimo 1' } })])).toBe(
      'Mínimo 1',
    );
  });

  it('sin ningún mensaje usa uno genérico', () => {
    expect(primerMensaje([])).toBe('Los datos enviados no son válidos');
  });
});
