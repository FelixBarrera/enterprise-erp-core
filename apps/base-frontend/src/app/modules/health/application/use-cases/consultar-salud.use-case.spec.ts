import { Injector } from '@angular/core';
import type { EstadoSalud } from '../../domain/estado-salud';
import { VERIFICADOR_SALUD_PORT } from '../ports/out/verificador-salud.port';
import { ConsultarSaludUseCase } from './consultar-salud.use-case';

function crearCasoDeUso(estado: EstadoSalud): ConsultarSaludUseCase {
  const injector = Injector.create({
    providers: [
      ConsultarSaludUseCase,
      { provide: VERIFICADOR_SALUD_PORT, useValue: { consultar: () => Promise.resolve(estado) } },
    ],
  });
  return injector.get(ConsultarSaludUseCase);
}

describe('ConsultarSaludUseCase', () => {
  it('con todo en marcha, el servicio está disponible', async () => {
    const resumen = await crearCasoDeUso('en-marcha').execute();
    expect(resumen.disponible).toBe(true);
    expect(resumen.estado).toBe('en-marcha');
  });

  it('sin base de datos, el servicio no está disponible', async () => {
    const resumen = await crearCasoDeUso('sin-base-datos').execute();
    expect(resumen.disponible).toBe(false);
    expect(resumen.estado).toBe('sin-base-datos');
  });

  it('sin servidor, el servicio no está disponible', async () => {
    const resumen = await crearCasoDeUso('sin-servidor').execute();
    expect(resumen).toEqual({
      estado: 'sin-servidor',
      disponible: false,
      mensaje: 'No hay conexión con el servidor.',
    });
  });
});
