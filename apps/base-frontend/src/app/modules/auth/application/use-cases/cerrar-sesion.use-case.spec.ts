import { Injector } from '@angular/core';
import { ErrorHttp, TipoErrorHttp } from '../../../../shared/domain/errors/error-http';
import { DATOS_LOCALES_PORT } from '../ports/out/datos-locales.port';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';
import { SesionRemotaFalsa } from '../testing/sesion-remota-falsa';
import { CerrarSesionUseCase } from './cerrar-sesion.use-case';

function error(tipo: TipoErrorHttp, estado: number): ErrorHttp {
  return new ErrorHttp({
    tipo,
    mensaje: 'x',
    estado,
    respondioLaApi: estado !== 0,
    requestId: null,
    avisado: false,
  });
}

function crear(remota: SesionRemotaFalsa) {
  const datosLocales = { borrar: vi.fn(() => Promise.resolve()) };
  const casoDeUso = Injector.create({
    providers: [
      CerrarSesionUseCase,
      { provide: SESION_REMOTA_PORT, useValue: remota },
      { provide: DATOS_LOCALES_PORT, useValue: datosLocales },
    ],
  }).get(CerrarSesionUseCase);
  return { casoDeUso, datosLocales };
}

describe('CerrarSesionUseCase', () => {
  it('cierra en el backend y después borra lo guardado en el navegador', async () => {
    const remota = new SesionRemotaFalsa();
    const { casoDeUso, datosLocales } = crear(remota);
    await casoDeUso.execute();
    expect(remota.llamadas).toEqual(['cerrar']);
    expect(datosLocales.borrar).toHaveBeenCalledOnce();
  });

  it('si la sesión ya había terminado (401), sigue como si la hubiera cerrado', async () => {
    const remota = new SesionRemotaFalsa();
    remota.errorAlCerrar = error(TipoErrorHttp.NO_AUTENTICADO, 401);
    const { casoDeUso, datosLocales } = crear(remota);
    await casoDeUso.execute();
    expect(datosLocales.borrar).toHaveBeenCalledOnce();
  });

  it('sin conexión, lanza y no borra nada: la sesión se mantiene', async () => {
    const remota = new SesionRemotaFalsa();
    remota.errorAlCerrar = error(TipoErrorHttp.SIN_CONEXION, 0);
    const { casoDeUso, datosLocales } = crear(remota);
    await expect(casoDeUso.execute()).rejects.toBe(remota.errorAlCerrar);
    expect(datosLocales.borrar).not.toHaveBeenCalled();
  });
});
