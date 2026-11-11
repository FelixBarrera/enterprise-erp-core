import { ok, respuestaError } from './respuesta-api.js';

describe('respuestas de la API', () => {
  it('ok() arma la respuesta de éxito', () => {
    expect(ok({ id: 1 }, 'Listo')).toEqual({
      success: true,
      data: { id: 1 },
      message: 'Listo',
    });
  });

  it('respuestaError() arma la respuesta de error con data null', () => {
    expect(respuestaError('No')).toEqual({
      success: false,
      data: null,
      message: 'No',
    });
  });
});
