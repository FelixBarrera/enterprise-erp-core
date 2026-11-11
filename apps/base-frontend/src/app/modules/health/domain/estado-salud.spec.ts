import { resumirSalud } from './estado-salud';

describe('resumirSalud', () => {
  it('en marcha: disponible, con su mensaje', () => {
    expect(resumirSalud('en-marcha')).toEqual({
      estado: 'en-marcha',
      disponible: true,
      mensaje: 'El sistema está en marcha.',
    });
  });

  it('sin base de datos: no disponible', () => {
    const resumen = resumirSalud('sin-base-datos');
    expect(resumen.disponible).toBe(false);
    expect(resumen.mensaje).toBe('El servidor responde, pero la base de datos no está disponible.');
  });

  it('sin servidor: no disponible', () => {
    const resumen = resumirSalud('sin-servidor');
    expect(resumen.disponible).toBe(false);
    expect(resumen.mensaje).toBe('No hay conexión con el servidor.');
  });
});
