import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { erroresInterceptor } from '../../../../../../shared/infrastructure/http/errores.interceptor';
import { AuthApi, type SesionDto } from './auth.api';
import { SesionRemotaHttpAdapter } from './sesion-remota.http.adapter';

const SESION: SesionDto = {
  usuario: { id: 'u-1', nombreUsuario: 'ana', nombreCompleto: 'Ana', debeCambiarContrasena: false },
  empresaActiva: { id: 'e-1', nombre: 'Uno' },
  empresas: [{ id: 'e-1', nombre: 'Uno' }],
  esAdministrador: false,
  permisos: ['auth.usuario.ver'],
  zonaNegocio: 'America/Guayaquil',
  sesionVenceEn: '2026-07-15T18:00:00.000Z',
};

const ok = <T>(data: T) => ({ success: true, data, message: 'Listo' });
const fallo = (message: string) => ({ success: false, data: null, message });
const TOKEN = { tokenAcceso: 'jwt-1', expiraEnSegundos: 900, debeCambiarContrasena: false };

describe('SesionRemotaHttpAdapter', () => {
  let adaptador: SesionRemotaHttpAdapter;
  let http: HttpTestingController;
  const avisos = { error: vi.fn<(texto: string) => Promise<void>>() };

  beforeEach(() => {
    avisos.error.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificacionesService, useValue: avisos },
        AuthApi,
        SesionRemotaHttpAdapter,
      ],
    });
    adaptador = TestBed.inject(SesionRemotaHttpAdapter);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('entrar: POST /api/v1/auth/login con lo escrito, y el token', async () => {
    const promesa = adaptador.iniciar({ nombreUsuario: 'ana', contrasena: 'secreta' });
    const peticion = http.expectOne('/api/v1/auth/login');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ nombreUsuario: 'ana', contrasena: 'secreta' });
    peticion.flush(ok(TOKEN));
    expect(await promesa).toEqual({ valor: 'jwt-1', expiraEnSegundos: 900 });
  });

  it('entrar con credenciales inválidas: el mensaje del backend, sin aviso global', async () => {
    const promesa = adaptador.iniciar({ nombreUsuario: 'ana', contrasena: 'x' });
    http
      .expectOne('/api/v1/auth/login')
      .flush(fallo('Credenciales inválidas.'), { status: 401, statusText: 'x' });
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorHttp);
    expect((error as ErrorHttp).message).toBe('Credenciales inválidas.');
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('entrar sin empresa (403): lo muestra el login, no el aviso global', async () => {
    const promesa = adaptador.iniciar({ nombreUsuario: 'ana', contrasena: 'x' });
    http
      .expectOne('/api/v1/auth/login')
      .flush(fallo('Su usuario no tiene acceso a ninguna empresa.'), {
        status: 403,
        statusText: 'x',
      });
    await expect(promesa).rejects.toBeInstanceOf(ErrorHttp);
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('renovar: POST /api/v1/auth/refresh y el token nuevo', async () => {
    const promesa = adaptador.renovar();
    const peticion = http.expectOne('/api/v1/auth/refresh');
    expect(peticion.request.method).toBe('POST');
    peticion.flush(ok({ ...TOKEN, tokenAcceso: 'jwt-2' }));
    expect(await promesa).toEqual({ valor: 'jwt-2', expiraEnSegundos: 900 });
  });

  it('renovar con la sesión terminada (401): null', async () => {
    const promesa = adaptador.renovar();
    http
      .expectOne('/api/v1/auth/refresh')
      .flush(fallo('Su sesión terminó'), { status: 401, statusText: 'x' });
    expect(await promesa).toBeNull();
  });

  it('renovar sin conexión: lanza (la sesión no se da por terminada)', async () => {
    const promesa = adaptador.renovar();
    http.expectOne('/api/v1/auth/refresh').error(new ProgressEvent('error'));
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorHttp);
    expect((error as ErrorHttp).tipo).toBe(TipoErrorHttp.SIN_CONEXION);
  });

  it('consultar: GET /api/v1/auth/sesion con ese token', async () => {
    const promesa = adaptador.consultar({ valor: 'jwt-9', expiraEnSegundos: 900 });
    const peticion = http.expectOne('/api/v1/auth/sesion');
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer jwt-9');
    peticion.flush(ok(SESION));
    expect(await promesa).toEqual(SESION);
  });

  it('cerrar: POST /api/v1/auth/logout', async () => {
    const promesa = adaptador.cerrar();
    const peticion = http.expectOne('/api/v1/auth/logout');
    expect(peticion.request.method).toBe('POST');
    peticion.flush(ok(null));
    await expect(promesa).resolves.toBeUndefined();
  });

  it('cambiar la contraseña: POST /api/v1/auth/cambiar-contrasena con la actual y la nueva', async () => {
    const promesa = adaptador.cambiarContrasena({ actual: 'Temporal-1', nueva: 'Girasol-83' });
    const peticion = http.expectOne('/api/v1/auth/cambiar-contrasena');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      contrasenaActual: 'Temporal-1',
      contrasenaNueva: 'Girasol-83',
    });
    peticion.flush(ok(null));
    await expect(promesa).resolves.toBeUndefined();
  });

  it('cambiar la contraseña con la cuenta bloqueada (403): lo muestra la pantalla', async () => {
    const promesa = adaptador.cambiarContrasena({ actual: 'mala', nueva: 'Girasol-83' });
    http
      .expectOne('/api/v1/auth/cambiar-contrasena')
      .flush(fallo('Demasiados intentos fallidos. Espere 15 minutos.'), {
        status: 403,
        statusText: 'x',
      });
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect((error as ErrorHttp).message).toBe('Demasiados intentos fallidos. Espere 15 minutos.');
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('cambiar la contraseña sin conexión: tampoco aviso global (la pantalla lo dice)', async () => {
    const promesa = adaptador.cambiarContrasena({ actual: 'x', nueva: 'Girasol-83' });
    http.expectOne('/api/v1/auth/cambiar-contrasena').error(new ProgressEvent('error'));
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect((error as ErrorHttp).tipo).toBe(TipoErrorHttp.SIN_CONEXION);
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('cambiar de empresa: POST /api/v1/auth/empresa con el id, y la sesión nueva', async () => {
    const promesa = adaptador.cambiarEmpresa('e-2');
    const peticion = http.expectOne('/api/v1/auth/empresa');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ empresaId: 'e-2' });
    peticion.flush(ok({ ...SESION, empresaActiva: { id: 'e-2', nombre: 'Dos' } }));
    expect((await promesa).empresaActiva).toEqual({ id: 'e-2', nombre: 'Dos' });
  });

  it('cambiar a una empresa sin acceso (403): con el aviso global', async () => {
    const promesa = adaptador.cambiarEmpresa('e-9');
    http
      .expectOne('/api/v1/auth/empresa')
      .flush(fallo('No tiene acceso a esa empresa'), { status: 403, statusText: 'x' });
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect((error as ErrorHttp).avisado).toBe(true);
    expect(avisos.error).toHaveBeenCalledWith('No tiene acceso a esa empresa');
  });
});
