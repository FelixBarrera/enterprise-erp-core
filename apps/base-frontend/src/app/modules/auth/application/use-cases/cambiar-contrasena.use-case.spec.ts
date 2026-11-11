import { Injector } from '@angular/core';
import { ErrorHttp, TipoErrorHttp } from '../../../../shared/domain/errors/error-http';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';
import { sesionDePrueba } from '../testing/sesion-de-prueba';
import { SesionRemotaFalsa } from '../testing/sesion-remota-falsa';
import { CambiarContrasenaUseCase } from './cambiar-contrasena.use-case';

function crear(remota: SesionRemotaFalsa): CambiarContrasenaUseCase {
  return Injector.create({
    providers: [CambiarContrasenaUseCase, { provide: SESION_REMOTA_PORT, useValue: remota }],
  }).get(CambiarContrasenaUseCase);
}

const temporal = () =>
  sesionDePrueba({ usuario: { ...sesionDePrueba().usuario, debeCambiarContrasena: true } });

describe('CambiarContrasenaUseCase', () => {
  it('la cambia en el backend y devuelve la sesión ya sin contraseña temporal', async () => {
    const remota = new SesionRemotaFalsa();
    const sesion = temporal();
    const nueva = await crear(remota).execute(
      { actual: 'Temporal-1', nueva: 'Girasol-83' },
      sesion,
    );
    expect(remota.llamadas).toEqual(['cambiarContrasena']);
    expect(remota.cambios).toEqual([{ actual: 'Temporal-1', nueva: 'Girasol-83' }]);
    expect(nueva.usuario.debeCambiarContrasena).toBe(false);
    expect(nueva.empresaActiva).toEqual(sesion.empresaActiva);
  });

  it('si el backend la rechaza, lanza su error y no da sesión nueva', async () => {
    const remota = new SesionRemotaFalsa();
    remota.errorAlCambiarContrasena = new ErrorHttp({
      tipo: TipoErrorHttp.VALIDACION,
      mensaje: 'La contraseña actual no es correcta',
      estado: 400,
      respondioLaApi: true,
      requestId: null,
      avisado: false,
    });
    await expect(
      crear(remota).execute({ actual: 'mala', nueva: 'Girasol-83' }, temporal()),
    ).rejects.toBe(remota.errorAlCambiarContrasena);
  });
});
