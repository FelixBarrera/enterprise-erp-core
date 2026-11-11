import { Injector } from '@angular/core';
import { ErrorHttp, TipoErrorHttp } from '../../../../shared/domain/errors/error-http';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';
import { SesionRemotaFalsa } from '../testing/sesion-remota-falsa';
import { RenovarSesionUseCase } from './renovar-sesion.use-case';

function crear(remota: SesionRemotaFalsa): RenovarSesionUseCase {
  return Injector.create({
    providers: [RenovarSesionUseCase, { provide: SESION_REMOTA_PORT, useValue: remota }],
  }).get(RenovarSesionUseCase);
}

describe('RenovarSesionUseCase', () => {
  it('renueva y vuelve a leer la sesión (los permisos al día) con el token nuevo', async () => {
    const remota = new SesionRemotaFalsa();
    const abierta = await crear(remota).execute();
    expect(remota.llamadas).toEqual(['renovar', 'consultar']);
    expect(remota.consultadaCon).toBe(remota.tokenDelRefresh);
    expect(abierta).toEqual({ token: remota.tokenDelRefresh, sesion: remota.sesion });
  });

  it('si la sesión terminó, null y no consulta nada más', async () => {
    const remota = new SesionRemotaFalsa();
    remota.tokenDelRefresh = null;
    expect(await crear(remota).execute()).toBeNull();
    expect(remota.llamadas).toEqual(['renovar']);
  });

  it('sin conexión, lanza (la sesión no se da por terminada)', async () => {
    const remota = new SesionRemotaFalsa();
    remota.errorAlRenovar = new ErrorHttp({
      tipo: TipoErrorHttp.SIN_CONEXION,
      mensaje: 'Sin conexión',
      estado: 0,
      respondioLaApi: false,
      requestId: null,
      avisado: true,
    });
    await expect(crear(remota).execute()).rejects.toBe(remota.errorAlRenovar);
  });
});
