import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { erroresInterceptor } from '../../../../../../shared/infrastructure/http/errores.interceptor';
import type { RolDto } from './roles.api';
import { RolesApi } from './roles.api';
import { parametrosDeLista, RolesRemotosHttpAdapter } from './roles-remotos.http.adapter';

const ROL: RolDto = {
  id: 'r-1',
  nombre: 'Caja',
  descripcion: null,
  esAdministrador: false,
  activo: true,
  cantidadUsuarios: 2,
  permisos: ['auth.rol.ver'],
  creado: { en: '2026-11-02T15:15:00.000Z', por: 'ana.perez' },
  modificado: null,
};

const ok = <T>(data: T) => ({ success: true, data, message: '' });

describe('parametrosDeLista', () => {
  it('sin filtros: solo la página', () => {
    expect(parametrosDeLista({ texto: ' ', estado: 'todos' }, { pagina: 1, tamano: 20 })).toEqual({
      pagina: '1',
      tamano: '20',
    });
  });

  it('con texto y estado', () => {
    expect(
      parametrosDeLista({ texto: ' caja ', estado: 'desactivados' }, { pagina: 2, tamano: 50 }),
    ).toEqual({ texto: 'caja', activo: 'false', pagina: '2', tamano: '50' });
    expect(
      parametrosDeLista({ texto: '', estado: 'activos' }, { pagina: 1, tamano: 20 }).activo,
    ).toBe('true');
  });
});

describe('RolesRemotosHttpAdapter', () => {
  let adaptador: RolesRemotosHttpAdapter;
  let http: HttpTestingController;
  const avisos = { error: vi.fn<(texto: string) => Promise<void>>() };

  beforeEach(() => {
    avisos.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroresInterceptor])),
        { provide: NotificacionesService, useValue: avisos },
        provideHttpClientTesting(),
        RolesApi,
        RolesRemotosHttpAdapter,
      ],
    });
    adaptador = TestBed.inject(RolesRemotosHttpAdapter);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar: GET /api/v1/roles con los filtros', async () => {
    const promesa = adaptador.listar(
      { texto: 'caja', estado: 'activos' },
      { pagina: 1, tamano: 20 },
    );
    const peticion = http.expectOne((r) => r.url === '/api/v1/roles');
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.toString()).toBe('texto=caja&activo=true&pagina=1&tamano=20');
    peticion.flush(
      ok({
        elementos: [{ ...ROL, cantidadPermisos: 1, permisos: undefined }],
        total: 1,
        pagina: 1,
        tamano: 20,
      }),
    );
    const pagina = await promesa;
    expect(pagina.total).toBe(1);
    expect(pagina.elementos[0]).toEqual({
      id: 'r-1',
      nombre: 'Caja',
      descripcion: null,
      esAdministrador: false,
      activo: true,
      cantidadUsuarios: 2,
      cantidadPermisos: 1,
    });
  });

  it('ver: GET /api/v1/roles/:id', async () => {
    const promesa = adaptador.ver('r-1');
    http.expectOne('/api/v1/roles/r-1').flush(ok(ROL));
    expect(await promesa).toEqual(ROL);
  });

  it('ver un rol que no existe: el 404 llega a la pantalla, sin aviso global', async () => {
    const promesa = adaptador.ver('r-9');
    http
      .expectOne('/api/v1/roles/r-9')
      .flush(
        { success: false, data: null, message: 'El rol no existe' },
        { status: 404, statusText: 'Not Found' },
      );
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorHttp);
    expect((error as ErrorHttp).tipo).toBe(TipoErrorHttp.NO_ENCONTRADO);
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('editar: PATCH con solo lo que cambió', async () => {
    const promesa = adaptador.editar('r-1', { descripcion: null });
    const peticion = http.expectOne('/api/v1/roles/r-1');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ descripcion: null });
    peticion.flush(ok(ROL));
    expect((await promesa).nombre).toBe('Caja');
  });

  it('desactivar y reactivar: POST a su ruta', async () => {
    const desactivar = adaptador.desactivar('r-1');
    const p1 = http.expectOne('/api/v1/roles/r-1/desactivar');
    expect(p1.request.method).toBe('POST');
    p1.flush(ok({ ...ROL, activo: false }));
    expect((await desactivar).activo).toBe(false);

    const reactivar = adaptador.reactivar('r-1');
    http.expectOne('/api/v1/roles/r-1/reactivar').flush(ok(ROL));
    expect((await reactivar).activo).toBe(true);
  });

  it('crear: POST /api/v1/roles con datos y permisos', async () => {
    const promesa = adaptador.crear({
      nombre: 'Caja',
      descripcion: null,
      permisos: ['auth.rol.ver'],
    });
    const peticion = http.expectOne('/api/v1/roles');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      nombre: 'Caja',
      descripcion: null,
      permisos: ['auth.rol.ver'],
    });
    peticion.flush(ok(ROL), { status: 201, statusText: 'Created' });
    expect((await promesa).id).toBe('r-1');
  });

  it('fijarPermisos: PUT /api/v1/roles/:id/permisos con la lista completa', async () => {
    const promesa = adaptador.fijarPermisos('r-1', ['auth.rol.ver', 'auth.usuario.ver']);
    const peticion = http.expectOne('/api/v1/roles/r-1/permisos');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({ permisos: ['auth.rol.ver', 'auth.usuario.ver'] });
    peticion.flush(ok({ ...ROL, permisos: ['auth.rol.ver', 'auth.usuario.ver'] }));
    expect((await promesa).permisos).toEqual(['auth.rol.ver', 'auth.usuario.ver']);
  });

  it('catalogo: GET /api/v1/permisos, por grupo', async () => {
    const promesa = adaptador.catalogo();
    const grupo = {
      modulo: 'auth',
      nombre: 'Usuarios y roles',
      permisos: [{ codigo: 'auth.rol.ver', descripcion: 'Ver roles' }],
    };
    http.expectOne('/api/v1/permisos').flush(ok([grupo]));
    expect(await promesa).toEqual([grupo]);
  });
});
