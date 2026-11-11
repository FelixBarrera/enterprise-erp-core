import { Injector } from '@angular/core';
import { ErrorHttp, TipoErrorHttp } from '../../../../shared/domain/errors/error-http';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';
import { SesionRemotaFalsa } from '../testing/sesion-remota-falsa';
import { IniciarSesionUseCase } from './iniciar-sesion.use-case';

function crear(remota: SesionRemotaFalsa): IniciarSesionUseCase {
  return Injector.create({
    providers: [IniciarSesionUseCase, { provide: SESION_REMOTA_PORT, useValue: remota }],
  }).get(IniciarSesionUseCase);
}

describe('IniciarSesionUseCase', () => {
  it('entra y lee la sesión con el token que le dieron', async () => {
    const remota = new SesionRemotaFalsa();
    const resultado = await crear(remota).execute({ nombreUsuario: 'ana', contrasena: 'x' });
    expect(remota.llamadas).toEqual(['iniciar:ana', 'consultar']);
    expect(remota.consultadaCon).toBe(remota.tokenDelLogin);
    expect(resultado).toEqual({
      tipo: 'sesion-iniciada',
      sesion: { token: remota.tokenDelLogin, sesion: remota.sesion },
    });
  });

  it('con credenciales inválidas lanza el error del backend y no lee la sesión', async () => {
    const remota = new SesionRemotaFalsa();
    remota.errorAlEntrar = new ErrorHttp({
      tipo: TipoErrorHttp.NO_AUTENTICADO,
      mensaje: 'Credenciales inválidas.',
      estado: 401,
      respondioLaApi: true,
      requestId: null,
      avisado: false,
    });
    await expect(crear(remota).execute({ nombreUsuario: 'ana', contrasena: 'x' })).rejects.toBe(
      remota.errorAlEntrar,
    );
    expect(remota.llamadas).toEqual(['iniciar:ana']);
  });
});
