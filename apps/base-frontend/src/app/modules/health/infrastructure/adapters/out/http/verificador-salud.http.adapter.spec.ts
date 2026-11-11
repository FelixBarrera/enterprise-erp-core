import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { erroresInterceptor } from '../../../../../../shared/infrastructure/http/errores.interceptor';
import { HealthApi } from './health.api';
import { VerificadorSaludHttpAdapter } from './verificador-salud.http.adapter';

describe('VerificadorSaludHttpAdapter', () => {
  let adaptador: VerificadorSaludHttpAdapter;
  let http: HttpTestingController;
  const avisos = { error: vi.fn<(texto: string) => Promise<void>>() };

  beforeEach(() => {
    avisos.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        // Con el interceptor de errores, como en la aplicación.
        provideHttpClient(withInterceptors([erroresInterceptor])),
        { provide: NotificacionesService, useValue: avisos },
        provideHttpClientTesting(),
        HealthApi,
        VerificadorSaludHttpAdapter,
      ],
    });
    adaptador = TestBed.inject(VerificadorSaludHttpAdapter);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    // La pantalla muestra ella misma la falla: nunca el aviso global.
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('pide GET /api/v1/health (URL relativa)', async () => {
    const promesa = adaptador.consultar();
    const peticion = http.expectOne('/api/v1/health');
    expect(peticion.request.method).toBe('GET');
    peticion.flush({
      success: true,
      data: { disponible: true, baseDatos: 'ok' },
      message: 'Servicio en marcha',
    });
    expect(await promesa).toBe('en-marcha');
  });

  it('200 con la base caída: sin base de datos', async () => {
    const promesa = adaptador.consultar();
    http
      .expectOne('/api/v1/health')
      .flush({ success: true, data: { disponible: false, baseDatos: 'falla' }, message: '' });
    expect(await promesa).toBe('sin-base-datos');
  });

  it('503 de la API: sin base de datos', async () => {
    const promesa = adaptador.consultar();
    http
      .expectOne('/api/v1/health')
      .flush(
        { success: false, data: null, message: 'El servicio no está disponible en este momento' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    expect(await promesa).toBe('sin-base-datos');
  });

  it('503 que no viene de la API (proxy o Nginx): sin servidor', async () => {
    const promesa = adaptador.consultar();
    http
      .expectOne('/api/v1/health')
      .flush('<html>503</html>', { status: 503, statusText: 'Service Unavailable' });
    expect(await promesa).toBe('sin-servidor');
  });

  it('500 del proxy de desarrollo (API apagada): sin servidor', async () => {
    const promesa = adaptador.consultar();
    http
      .expectOne('/api/v1/health')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    expect(await promesa).toBe('sin-servidor');
  });

  it('sin red: sin servidor', async () => {
    const promesa = adaptador.consultar();
    http.expectOne('/api/v1/health').error(new ProgressEvent('error'));
    expect(await promesa).toBe('sin-servidor');
  });
});
