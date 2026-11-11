import { Injector } from '@angular/core';
import { ErrorHttp, TipoErrorHttp } from '../../../../shared/domain/errors/error-http';
import { DATOS_LOCALES_PORT } from '../ports/out/datos-locales.port';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';
import { sesionDePrueba } from '../testing/sesion-de-prueba';
import { SesionRemotaFalsa } from '../testing/sesion-remota-falsa';
import { CambiarEmpresaUseCase } from './cambiar-empresa.use-case';

function crear(remota: SesionRemotaFalsa) {
  const datosLocales = { borrar: vi.fn(() => Promise.resolve()) };
  const casoDeUso = Injector.create({
    providers: [
      CambiarEmpresaUseCase,
      { provide: SESION_REMOTA_PORT, useValue: remota },
      { provide: DATOS_LOCALES_PORT, useValue: datosLocales },
    ],
  }).get(CambiarEmpresaUseCase);
  return { casoDeUso, datosLocales };
}

describe('CambiarEmpresaUseCase', () => {
  it('cambia en el backend, borra los datos locales y devuelve la sesión nueva', async () => {
    const remota = new SesionRemotaFalsa();
    remota.sesion = sesionDePrueba({ empresaActiva: { id: 'e-2', nombre: 'Empresa Dos' } });
    const { casoDeUso, datosLocales } = crear(remota);
    const sesion = await casoDeUso.execute('e-2');
    expect(remota.llamadas).toEqual(['cambiarEmpresa:e-2']);
    expect(datosLocales.borrar).toHaveBeenCalledOnce();
    expect(sesion.empresaActiva).toEqual({ id: 'e-2', nombre: 'Empresa Dos' });
  });

  it('si el backend la rechaza, lanza su error y no borra nada', async () => {
    const remota = new SesionRemotaFalsa();
    remota.errorAlCambiarEmpresa = new ErrorHttp({
      tipo: TipoErrorHttp.NO_AUTORIZADO,
      mensaje: 'No tiene acceso a esa empresa',
      estado: 403,
      respondioLaApi: true,
      requestId: null,
      avisado: true,
    });
    const { casoDeUso, datosLocales } = crear(remota);
    await expect(casoDeUso.execute('e-9')).rejects.toBe(remota.errorAlCambiarEmpresa);
    expect(datosLocales.borrar).not.toHaveBeenCalled();
  });
});
