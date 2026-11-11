import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ErrorHttp, TipoErrorHttp } from '../../domain/errors/error-http';
import { NotificacionesService } from '../avisos/notificaciones.service';
import { erroresInterceptor, SIN_AVISO_GLOBAL } from './errores.interceptor';

describe('erroresInterceptor', () => {
  let cliente: HttpClient;
  let http: HttpTestingController;
  const avisos = { error: vi.fn<(texto: string) => Promise<void>>() };

  beforeEach(() => {
    avisos.error.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificacionesService, useValue: avisos },
      ],
    });
    cliente = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  // Además prueba que no hay reintentos: una sola petición por llamada.
  afterEach(() => http.verify());

  async function fallar(
    respuesta: { cuerpo: object | null; status: number },
    context?: HttpContext,
  ): Promise<ErrorHttp> {
    const promesa = firstValueFrom(cliente.post('/api/v1/algo', {}, { context }));
    http
      .expectOne('/api/v1/algo')
      .flush(respuesta.cuerpo, { status: respuesta.status, statusText: 'x' });
    const error: unknown = await promesa.catch((e: unknown) => e);
    if (!(error instanceof ErrorHttp)) throw new Error('Se esperaba un ErrorHttp');
    return error;
  }

  const api = (message: string) => ({ success: false, data: null, message });

  it('403 → aviso global con el mensaje del backend y el error queda avisado', async () => {
    const error = await fallar({ cuerpo: api('No tiene permiso para esta acción'), status: 403 });
    expect(error.tipo).toBe(TipoErrorHttp.NO_AUTORIZADO);
    expect(error.avisado).toBe(true);
    expect(avisos.error).toHaveBeenCalledExactlyOnceWith('No tiene permiso para esta acción');
  });

  it('5xx → aviso global genérico', async () => {
    await fallar({ cuerpo: api('El servicio no está disponible'), status: 503 });
    expect(avisos.error).toHaveBeenCalledExactlyOnceWith(
      'El servidor no está disponible. Intente de nuevo en unos minutos.',
    );
  });

  it('sin red → aviso global', async () => {
    const promesa = firstValueFrom(cliente.get('/api/v1/algo'));
    http.expectOne('/api/v1/algo').error(new ProgressEvent('error'));
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorHttp);
    expect(avisos.error).toHaveBeenCalledOnce();
  });

  it.each([400, 401, 404, 409, 422, 429])(
    '%i → sin aviso global: lo muestra la pantalla',
    async (status) => {
      const error = await fallar({ cuerpo: api('Mensaje para la pantalla'), status });
      expect(error.avisado).toBe(false);
      expect(error.message).toBe('Mensaje para la pantalla');
      expect(avisos.error).not.toHaveBeenCalled();
    },
  );

  it('con SIN_AVISO_GLOBAL no avisa, aunque sea un 5xx', async () => {
    const error = await fallar(
      { cuerpo: null, status: 500 },
      new HttpContext().set(SIN_AVISO_GLOBAL, true),
    );
    expect(error.tipo).toBe(TipoErrorHttp.SERVIDOR_NO_DISPONIBLE);
    expect(error.avisado).toBe(false);
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('una respuesta correcta pasa sin tocarla', async () => {
    const promesa = firstValueFrom(cliente.get('/api/v1/algo'));
    http.expectOne('/api/v1/algo').flush({ success: true, data: 1, message: 'Listo' });
    expect(await promesa).toEqual({ success: true, data: 1, message: 'Listo' });
    expect(avisos.error).not.toHaveBeenCalled();
  });
});
