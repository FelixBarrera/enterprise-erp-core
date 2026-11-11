import type { VerificadorBaseDatosPort } from '../ports/out/verificador-base-datos.port.js';
import { ConsultarSaludUseCase } from './consultar-salud.use-case.js';

const verificador = (responde: boolean): VerificadorBaseDatosPort => ({
  responde: () => Promise.resolve(responde),
});

describe('ConsultarSaludUseCase', () => {
  it('disponible si la base responde', async () => {
    const estado = await new ConsultarSaludUseCase(verificador(true)).execute();
    expect(estado).toEqual({ disponible: true, baseDatos: 'ok' });
  });

  it('no disponible si la base no responde', async () => {
    const estado = await new ConsultarSaludUseCase(verificador(false)).execute();
    expect(estado).toEqual({ disponible: false, baseDatos: 'falla' });
  });
});
