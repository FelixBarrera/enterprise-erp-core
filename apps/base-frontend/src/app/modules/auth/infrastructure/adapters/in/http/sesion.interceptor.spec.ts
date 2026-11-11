import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { erroresInterceptor } from '../../../../../../shared/infrastructure/http/errores.interceptor';
import { sesionDePrueba, tokenDePrueba } from '../../../../application/testing/sesion-de-prueba';
import { AuthApi } from '../../out/http/auth.api';
import { SesionFacade } from '../../../presentation/facades/sesion.facade';
import { AuthStore } from '../../../presentation/stores/auth.store';
import { sesionInterceptor } from './sesion.interceptor';

const NO_AUTENTICADO = { success: false, data: null, message: 'Token vencido' };

function montar() {
  const facade = {
    renovar: vi.fn<(token: string | null) => Promise<string | null>>(() =>
      Promise.resolve('nuevo'),
    ),
    irAlLogin: vi.fn(() => Promise.resolve()),
  };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([sesionInterceptor, erroresInterceptor])),
      provideHttpClientTesting(),
      { provide: NotificacionesService, useValue: { error: vi.fn(() => Promise.resolve()) } },
      { provide: SesionFacade, useValue: facade },
      AuthApi,
    ],
  });
  const store = TestBed.inject(AuthStore);
  store.fijar({ token: tokenDePrueba('viejo'), sesion: sesionDePrueba() });
  return {
    cliente: TestBed.inject(HttpClient),
    http: TestBed.inject(HttpTestingController),
    api: TestBed.inject(AuthApi),
    store,
    facade,
  };
}

/** Deja que las promesas pendientes avancen (la renovación es una promesa). */
const avanzar = () => new Promise((r) => setTimeout(r));

describe('sesionInterceptor', () => {
  it('pone el token de la sesión en las peticiones a la API', async () => {
    const { cliente, http } = montar();
    const promesa = firstValueFrom(cliente.get('/api/v1/usuarios'));
    const peticion = http.expectOne('/api/v1/usuarios');
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer viejo');
    peticion.flush({ success: true, data: [], message: '' });
    await promesa;
    http.verify();
  });

  it('a otra dirección (no la API) no le pone el token', async () => {
    const { cliente, http } = montar();
    const promesa = firstValueFrom(cliente.get('/marca/logo.svg', { responseType: 'text' }));
    const peticion = http.expectOne('/marca/logo.svg');
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush('<svg/>');
    await promesa;
  });

  it('el login y el refresh pasan sin token y sin renovar ante un 401', async () => {
    const { api, http, facade } = montar();
    const login = firstValueFrom(api.iniciar('ana', 'x')).catch((e: unknown) => e);
    const peticion = http.expectOne('/api/v1/auth/login');
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush(NO_AUTENTICADO, { status: 401, statusText: 'x' });
    expect(await login).toBeInstanceOf(ErrorHttp);
    expect(facade.renovar).not.toHaveBeenCalled();
  });

  it('un 401: renueva y repite la petición una vez con el token nuevo', async () => {
    const { cliente, http, facade } = montar();
    const promesa = firstValueFrom(cliente.get('/api/v1/usuarios'));
    http.expectOne('/api/v1/usuarios').flush(NO_AUTENTICADO, { status: 401, statusText: 'x' });
    await avanzar();
    expect(facade.renovar).toHaveBeenCalledWith('viejo');
    const repetida = http.expectOne('/api/v1/usuarios');
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer nuevo');
    repetida.flush({ success: true, data: [1], message: '' });
    expect(await promesa).toEqual({ success: true, data: [1], message: '' });
    http.verify();
  });

  it('si la repetida también da 401, no vuelve a intentar', async () => {
    const { cliente, http, facade } = montar();
    const promesa = firstValueFrom(cliente.get('/api/v1/usuarios')).catch((e: unknown) => e);
    http.expectOne('/api/v1/usuarios').flush(NO_AUTENTICADO, { status: 401, statusText: 'x' });
    await avanzar();
    http.expectOne('/api/v1/usuarios').flush(NO_AUTENTICADO, { status: 401, statusText: 'x' });
    const error = await promesa;
    expect(error).toBeInstanceOf(ErrorHttp);
    expect(facade.renovar).toHaveBeenCalledOnce();
    http.verify();
  });

  it('si la sesión terminó: va al login y la petición falla con el 401', async () => {
    const { cliente, http, facade } = montar();
    facade.renovar.mockResolvedValueOnce(null);
    const promesa = firstValueFrom(cliente.get('/api/v1/usuarios')).catch((e: unknown) => e);
    http.expectOne('/api/v1/usuarios').flush(NO_AUTENTICADO, { status: 401, statusText: 'x' });
    const error = await promesa;
    expect((error as ErrorHttp).tipo).toBe(TipoErrorHttp.NO_AUTENTICADO);
    expect(facade.irAlLogin).toHaveBeenCalledOnce();
    http.verify();
  });

  it('sin conexión al renovar: el error de la red, y no va al login', async () => {
    const { cliente, http, facade } = montar();
    const sinRed = new ErrorHttp({
      tipo: TipoErrorHttp.SIN_CONEXION,
      mensaje: 'Sin conexión',
      estado: 0,
      respondioLaApi: false,
      requestId: null,
      avisado: true,
    });
    facade.renovar.mockRejectedValueOnce(sinRed);
    const promesa = firstValueFrom(cliente.get('/api/v1/usuarios')).catch((e: unknown) => e);
    http.expectOne('/api/v1/usuarios').flush(NO_AUTENTICADO, { status: 401, statusText: 'x' });
    expect(await promesa).toBe(sinRed);
    expect(facade.irAlLogin).not.toHaveBeenCalled();
  });

  it('sin sesión, un 401 no intenta renovar', async () => {
    const { cliente, http, facade, store } = montar();
    store.limpiar();
    const promesa = firstValueFrom(cliente.get('/api/v1/usuarios')).catch((e: unknown) => e);
    const peticion = http.expectOne('/api/v1/usuarios');
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush(NO_AUTENTICADO, { status: 401, statusText: 'x' });
    expect(await promesa).toBeInstanceOf(ErrorHttp);
    expect(facade.renovar).not.toHaveBeenCalled();
  });

  it('otros errores (403, 500) pasan sin renovar', async () => {
    const { cliente, http, facade } = montar();
    const promesa = firstValueFrom(cliente.get('/api/v1/usuarios')).catch((e: unknown) => e);
    http
      .expectOne('/api/v1/usuarios')
      .flush(
        { success: false, data: null, message: 'Sin permiso' },
        { status: 403, statusText: 'x' },
      );
    expect(((await promesa) as ErrorHttp).tipo).toBe(TipoErrorHttp.NO_AUTORIZADO);
    expect(facade.renovar).not.toHaveBeenCalled();
  });
});
