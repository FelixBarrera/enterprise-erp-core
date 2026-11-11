import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { erroresInterceptor } from '../../../../../../shared/infrastructure/http/errores.interceptor';
import { eventoDePrueba } from '../../../../application/testing/eventos-de-prueba';
import { BitacoraApi } from './bitacora.api';
import { BitacoraRemotaHttpAdapter } from './bitacora-remota.http.adapter';

const FILTROS = {
  desde: '2026-11-01',
  hasta: '2026-11-07',
  usuario: '',
  accion: '',
  registro: null,
};
const ID_USUARIO = '0190a4f2-1c2b-7000-8000-000000000102';

describe('BitacoraRemotaHttpAdapter', () => {
  let adaptador: BitacoraRemotaHttpAdapter;
  let http: HttpTestingController;
  const avisos = { error: vi.fn<(texto: string) => Promise<void>>() };

  beforeEach(() => {
    avisos.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroresInterceptor])),
        { provide: NotificacionesService, useValue: avisos },
        provideHttpClientTesting(),
        BitacoraApi,
        BitacoraRemotaHttpAdapter,
      ],
    });
    adaptador = TestBed.inject(BitacoraRemotaHttpAdapter);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar sin filtros: solo las fechas y la página', async () => {
    const promesa = adaptador.listar(FILTROS, { pagina: 1, tamano: 20 });
    const peticion = http.expectOne((r) => r.url === '/api/v1/auditoria/eventos');
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.keys().sort()).toEqual(['desde', 'hasta', 'pagina', 'tamano']);
    expect(peticion.request.params.get('desde')).toBe('2026-11-01');
    expect(peticion.request.params.get('hasta')).toBe('2026-11-07');
    const evento = eventoDePrueba();
    peticion.flush({
      success: true,
      data: { elementos: [evento], total: 1, pagina: 1, tamano: 20 },
      message: 'Eventos de la bitácora',
    });
    expect(await promesa).toEqual({ elementos: [evento], total: 1, pagina: 1, tamano: 20 });
  });

  it('listar con usuario y acción', async () => {
    const promesa = adaptador.listar(
      { ...FILTROS, usuario: 'u-1', accion: 'auth.usuario' },
      { pagina: 2, tamano: 50 },
    );
    const peticion = http.expectOne((r) => r.url === '/api/v1/auditoria/eventos');
    expect(peticion.request.params.get('usuarioId')).toBe('u-1');
    expect(peticion.request.params.get('accion')).toBe('auth.usuario');
    expect(peticion.request.params.get('pagina')).toBe('2');
    expect(peticion.request.params.get('tamano')).toBe('50');
    peticion.flush({
      success: true,
      data: { elementos: [], total: 0, pagina: 2, tamano: 50 },
      message: 'Eventos de la bitácora',
    });
    expect((await promesa).elementos).toEqual([]);
  });

  it('un rango de más de 92 días: el 400 llega como ErrorHttp, sin aviso global', async () => {
    const promesa = adaptador.listar(
      { ...FILTROS, desde: '2026-01-01' },
      { pagina: 1, tamano: 20 },
    );
    http
      .expectOne((r) => r.url === '/api/v1/auditoria/eventos')
      .flush(
        { success: false, data: null, message: 'El rango no puede pasar de 92 días' },
        { status: 400, statusText: 'Bad Request' },
      );
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorHttp);
    expect((error as ErrorHttp).tipo).toBe(TipoErrorHttp.VALIDACION);
    expect((error as ErrorHttp).message).toBe('El rango no puede pasar de 92 días');
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('la historia de un registro: entidad y entidadId, sin fechas si van vacías', async () => {
    const promesa = adaptador.listar(
      { ...FILTROS, desde: '', hasta: '', registro: { entidad: 'usuario', entidadId: ID_USUARIO } },
      { pagina: 1, tamano: 20 },
    );
    const peticion = http.expectOne((r) => r.url === '/api/v1/auditoria/eventos');
    expect(peticion.request.params.keys().sort()).toEqual([
      'entidad',
      'entidadId',
      'pagina',
      'tamano',
    ]);
    expect(peticion.request.params.get('entidadId')).toBe(ID_USUARIO);
    peticion.flush({
      success: true,
      data: { elementos: [], total: 0, pagina: 1, tamano: 20 },
      message: 'Eventos de la bitácora',
    });
    await promesa;
  });

  it('ver: GET /api/v1/auditoria/eventos/:id, con el antes y el después', async () => {
    const evento = eventoDePrueba();
    const promesa = adaptador.ver(evento.id);
    http.expectOne(`/api/v1/auditoria/eventos/${evento.id}`).flush({
      success: true,
      data: {
        ...evento,
        antes: { roles: ['Soporte'], datos: { a: 1 } },
        despues: { roles: ['Soporte', 'Cumplimiento'], sesionesCerradas: 2 },
        ip: '10.0.0.7',
        navegador: 'Mozilla/5.0',
        requestId: 'r-1',
      },
      message: 'Evento de la bitácora',
    });
    expect(await promesa).toEqual({
      ...evento,
      antes: { roles: ['Soporte'], datos: { a: 1 } },
      despues: { roles: ['Soporte', 'Cumplimiento'], sesionesCerradas: 2 },
      ip: '10.0.0.7',
      navegador: 'Mozilla/5.0',
      requestId: 'r-1',
    });
  });

  it('ver un evento sin cambios', async () => {
    const evento = eventoDePrueba({ accion: 'auth.sesion.iniciar' });
    const promesa = adaptador.ver(evento.id);
    http.expectOne(`/api/v1/auditoria/eventos/${evento.id}`).flush({
      success: true,
      data: { ...evento, antes: null, despues: null, ip: null, navegador: null, requestId: null },
      message: 'Evento de la bitácora',
    });
    const detalle = await promesa;
    expect(detalle.antes).toBeNull();
    expect(detalle.despues).toBeNull();
  });

  it('descripciones de los permisos: GET /api/v1/permisos, por código', async () => {
    const promesa = adaptador.descripcionesPermisos();
    http.expectOne('/api/v1/permisos').flush({
      success: true,
      data: [
        {
          modulo: 'auth',
          nombre: 'Usuarios',
          permisos: [{ codigo: 'auth.usuario.ver', descripcion: 'Ver usuarios' }],
        },
        {
          modulo: 'auditoria',
          nombre: 'Bitácora',
          permisos: [{ codigo: 'auditoria.evento.ver', descripcion: 'Ver la bitácora' }],
        },
      ],
      message: 'Catálogo de permisos',
    });
    expect([...(await promesa)]).toEqual([
      ['auth.usuario.ver', 'Ver usuarios'],
      ['auditoria.evento.ver', 'Ver la bitácora'],
    ]);
  });

  it('usuarios: GET /api/v1/auditoria/usuarios', async () => {
    const promesa = adaptador.usuarios();
    http.expectOne('/api/v1/auditoria/usuarios').flush({
      success: true,
      data: [{ usuarioId: 'u-1', nombreUsuario: 'ana.perez' }],
      message: 'Usuarios de la bitácora',
    });
    expect(await promesa).toEqual([{ usuarioId: 'u-1', nombreUsuario: 'ana.perez' }]);
  });
});
