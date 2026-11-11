import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { erroresInterceptor } from '../../../../../../shared/infrastructure/http/errores.interceptor';
import type { UsuarioDto } from './usuarios.api';
import { UsuariosApi } from './usuarios.api';
import {
  parametrosDeListaUsuarios,
  UsuariosRemotosHttpAdapter,
} from './usuarios-remotos.http.adapter';

const USUARIO: UsuarioDto = {
  id: 'u-1',
  nombreUsuario: 'jorge.vera',
  nombreCompleto: 'Jorge Vera',
  activo: true,
  bloqueadoHasta: null,
  ultimoIngresoEn: '2026-11-03T16:28:00.000Z',
  roles: [{ id: 'r-1', nombre: 'Soporte', esAdministrador: false, activo: true }],
  debeCambiarContrasena: false,
  trabajaEnOtrasEmpresas: true,
  sesiones: [
    {
      id: 's-1',
      iniciadaEn: '2026-11-06T13:10:00.000Z',
      ultimoUsoEn: '2026-11-06T15:45:00.000Z',
      ip: '10.0.0.7',
      navegador: 'Mozilla/5.0',
    },
  ],
  creado: { en: '2026-10-12T14:00:00.000Z', por: 'ana.perez' },
  modificado: null,
};

const ok = <T>(data: T) => ({ success: true, data, message: '' });

describe('parametrosDeListaUsuarios', () => {
  it('sin filtros: solo la página', () => {
    expect(
      parametrosDeListaUsuarios(
        { texto: ' ', rol: '', estado: 'todos' },
        { pagina: 1, tamano: 20 },
      ),
    ).toEqual({ pagina: '1', tamano: '20' });
  });

  it('con texto, rol y estado', () => {
    expect(
      parametrosDeListaUsuarios(
        { texto: ' ana ', rol: 'r-1', estado: 'desactivados' },
        { pagina: 2, tamano: 50 },
      ),
    ).toEqual({ texto: 'ana', activo: 'false', rolId: 'r-1', pagina: '2', tamano: '50' });
  });
});

describe('UsuariosRemotosHttpAdapter', () => {
  let adaptador: UsuariosRemotosHttpAdapter;
  let http: HttpTestingController;
  const avisos = { error: vi.fn<(texto: string) => Promise<void>>() };

  beforeEach(() => {
    avisos.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroresInterceptor])),
        { provide: NotificacionesService, useValue: avisos },
        provideHttpClientTesting(),
        UsuariosApi,
        UsuariosRemotosHttpAdapter,
      ],
    });
    adaptador = TestBed.inject(UsuariosRemotosHttpAdapter);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar: GET /api/v1/usuarios con los filtros', async () => {
    const promesa = adaptador.listar(
      { texto: 'ana', rol: 'r-1', estado: 'activos' },
      { pagina: 1, tamano: 20 },
    );
    const peticion = http.expectOne((r) => r.url === '/api/v1/usuarios');
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.toString()).toBe(
      'texto=ana&activo=true&rolId=r-1&pagina=1&tamano=20',
    );
    const { id, nombreUsuario, nombreCompleto, activo, bloqueadoHasta, ultimoIngresoEn, roles } =
      USUARIO;
    // Con la contraseña temporal pendiente: la lista dice «Debe cambiar su contraseña» (6.12c1).
    const fila = {
      id,
      nombreUsuario,
      nombreCompleto,
      activo,
      bloqueadoHasta,
      ultimoIngresoEn,
      roles,
      debeCambiarContrasena: true,
    };
    peticion.flush(ok({ elementos: [fila], total: 1, pagina: 1, tamano: 20 }));
    const pagina = await promesa;
    expect(pagina.total).toBe(1);
    expect(pagina.elementos[0]).toEqual(fila);
  });

  it('ver: GET /api/v1/usuarios/:id', async () => {
    const promesa = adaptador.ver('u-1');
    http.expectOne('/api/v1/usuarios/u-1').flush(ok(USUARIO));
    expect(await promesa).toEqual(USUARIO);
  });

  it('ver uno que no es de esta empresa: el 404 llega a la pantalla, sin aviso global', async () => {
    const promesa = adaptador.ver('u-9');
    http
      .expectOne('/api/v1/usuarios/u-9')
      .flush(
        { success: false, data: null, message: 'El usuario no existe' },
        { status: 404, statusText: 'Not Found' },
      );
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorHttp);
    expect((error as ErrorHttp).tipo).toBe(TipoErrorHttp.NO_ENCONTRADO);
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('rolesAsignables: GET /api/v1/usuarios/roles-asignables', async () => {
    const promesa = adaptador.rolesAsignables();
    const rol = {
      id: 'r-1',
      nombre: 'Soporte',
      descripcion: null,
      esAdministrador: false,
      sePuedeDar: true,
    };
    http.expectOne('/api/v1/usuarios/roles-asignables').flush(ok([rol]));
    expect(await promesa).toEqual([rol]);
  });

  it('editar: PATCH con solo lo que cambió', async () => {
    const promesa = adaptador.editar('u-1', { nombreCompleto: 'Jorge Vera Ruiz' });
    const peticion = http.expectOne('/api/v1/usuarios/u-1');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ nombreCompleto: 'Jorge Vera Ruiz' });
    peticion.flush(ok(USUARIO));
    expect((await promesa).id).toBe('u-1');
  });

  it('fijarRoles: PUT /usuarios/:id/roles con la lista', async () => {
    const promesa = adaptador.fijarRoles('u-1', ['r-1', 'r-2']);
    const peticion = http.expectOne('/api/v1/usuarios/u-1/roles');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({ roles: ['r-1', 'r-2'] });
    peticion.flush(ok(USUARIO));
    expect((await promesa).roles).toHaveLength(1);
  });

  it('quitarAcceso: POST /usuarios/:id/quitar-acceso', async () => {
    const promesa = adaptador.quitarAcceso('u-1');
    const peticion = http.expectOne('/api/v1/usuarios/u-1/quitar-acceso');
    expect(peticion.request.method).toBe('POST');
    peticion.flush(ok({ id: 'u-1', sesionesCerradas: 1 }));
    expect(await promesa).toEqual({ id: 'u-1', sesionesCerradas: 1 });
  });

  it('crear: POST /usuarios con los datos; trae la contraseña temporal', async () => {
    const promesa = adaptador.crear({
      nombreUsuario: 'lucia.torres',
      nombreCompleto: 'Lucía Torres',
      roles: ['r-1'],
    });
    const peticion = http.expectOne('/api/v1/usuarios');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      nombreUsuario: 'lucia.torres',
      nombreCompleto: 'Lucía Torres',
      roles: ['r-1'],
    });
    peticion.flush(ok({ usuario: USUARIO, contrasenaTemporal: 'k7Rm3xTq9vWb' }));
    const creado = await promesa;
    expect(creado.contrasenaTemporal).toBe('k7Rm3xTq9vWb');
    expect(creado.usuario.id).toBe('u-1');
  });

  it('crear con un nombre repetido: el 409 llega a la pantalla, sin aviso global', async () => {
    const promesa = adaptador.crear({
      nombreUsuario: 'ana',
      nombreCompleto: 'Ana',
      roles: ['r-1'],
    });
    http
      .expectOne('/api/v1/usuarios')
      .flush(
        { success: false, data: null, message: 'Ese nombre de usuario ya existe' },
        { status: 409, statusText: 'Conflict' },
      );
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorHttp);
    expect((error as ErrorHttp).tipo).toBe(TipoErrorHttp.CONFLICTO);
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('darContrasenaTemporal: POST /usuarios/:id/contrasena-temporal; trae la contraseña', async () => {
    const promesa = adaptador.darContrasenaTemporal('u-1');
    const peticion = http.expectOne('/api/v1/usuarios/u-1/contrasena-temporal');
    expect(peticion.request.method).toBe('POST');
    peticion.flush(
      ok({
        usuario: { ...USUARIO, debeCambiarContrasena: true },
        contrasenaTemporal: 'p4Hn8sLw2cXe',
      }),
    );
    const dada = await promesa;
    expect(dada.contrasenaTemporal).toBe('p4Hn8sLw2cXe');
    expect(dada.usuario.debeCambiarContrasena).toBe(true);
  });

  it('desbloquear, desactivar y reactivar: POST a su ruta; el usuario como quedó', async () => {
    const desbloquear = adaptador.desbloquear('u-1');
    http.expectOne('/api/v1/usuarios/u-1/desbloquear').flush(ok(USUARIO));
    expect((await desbloquear).bloqueadoHasta).toBeNull();

    const desactivar = adaptador.desactivar('u-1');
    const peticion = http.expectOne('/api/v1/usuarios/u-1/desactivar');
    expect(peticion.request.method).toBe('POST');
    peticion.flush(ok({ ...USUARIO, activo: false, sesiones: [] }));
    expect((await desactivar).activo).toBe(false);

    const reactivar = adaptador.reactivar('u-1');
    http.expectOne('/api/v1/usuarios/u-1/reactivar').flush(ok(USUARIO));
    expect((await reactivar).activo).toBe(true);
  });

  it('cerrarSesiones: POST /usuarios/:id/cerrar-sesiones; cuántas cerró', async () => {
    const promesa = adaptador.cerrarSesiones('u-1');
    const peticion = http.expectOne('/api/v1/usuarios/u-1/cerrar-sesiones');
    expect(peticion.request.method).toBe('POST');
    peticion.flush(ok({ id: 'u-1', sesionesCerradas: 4 }));
    expect(await promesa).toEqual({ id: 'u-1', sesionesCerradas: 4 });
  });

  it('dar una temporal a un desactivado: el 422 llega a la pantalla, sin aviso global', async () => {
    const promesa = adaptador.darContrasenaTemporal('u-1');
    http
      .expectOne('/api/v1/usuarios/u-1/contrasena-temporal')
      .flush(
        { success: false, data: null, message: 'El usuario «jorge.vera» está desactivado' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    const error: unknown = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorHttp);
    expect((error as ErrorHttp).avisado).toBe(false);
    expect(avisos.error).not.toHaveBeenCalled();
  });
});
