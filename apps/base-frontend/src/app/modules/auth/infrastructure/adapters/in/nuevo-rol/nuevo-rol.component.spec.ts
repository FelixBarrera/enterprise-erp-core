import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { MENU_APLICACION } from '../../../../../../shared/infrastructure/layout/menu';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { PermisosDePrueba } from '../../../../../../shared/infrastructure/permisos/permisos-de-prueba';
import { ADMINISTRAR_ROLES_PORT } from '../../../../application/ports/in/administrar-roles.port';
import { CONSULTAR_ROLES_PORT } from '../../../../application/ports/in/consultar-roles.port';
import { catalogoDePrueba, rolDePrueba } from '../../../../application/testing/roles-de-prueba';
import type { GrupoPermisos } from '../../../../domain/permisos-rol';
import type { Rol } from '../../../../domain/rol';
import { NuevoRolComponent } from './nuevo-rol.component';

function errorHttp(tipo: TipoErrorHttp, mensaje: string, estado: number, avisado = false) {
  return new ErrorHttp({ tipo, mensaje, estado, respondioLaApi: true, requestId: null, avisado });
}

async function montar(catalogo?: () => Promise<GrupoPermisos[]>) {
  const consultar = {
    listar: vi.fn(),
    ver: vi.fn(),
    catalogo: vi.fn(catalogo ?? (() => Promise.resolve(catalogoDePrueba()))),
  };
  const administrar = {
    guardar: vi.fn(),
    crear: vi.fn(() => Promise.resolve<Rol>(rolDePrueba({ id: 'r-9' }))),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
  };
  const avisos = { exito: vi.fn(() => Promise.resolve()), error: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    imports: [NuevoRolComponent],
    providers: [
      ...PROVIDERS_MATERIAL,
      provideRouter([]),
      { provide: MENU_APLICACION, useValue: [] },
      { provide: CONSULTAR_ROLES_PORT, useValue: consultar },
      { provide: ADMINISTRAR_ROLES_PORT, useValue: administrar },
      { provide: NotificacionesService, useValue: avisos },
      {
        provide: PERMISOS_SESION,
        useValue: new PermisosDePrueba(['auth.rol.crear', 'auth.rol.ver', 'auth.usuario.ver']),
      },
    ],
  });
  const router = TestBed.inject(Router);
  const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(NuevoRolComponent);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const listo = () => fixture.whenStable();
  const texto = () => (html.textContent ?? '').replace(/\s+/gu, ' ');
  const escribir = async (id: string, valor: string) => {
    const c = html.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#rol-${id}`)!;
    c.value = valor;
    c.dispatchEvent(new Event('input'));
    await listo();
  };
  const pestana = async (t: string) => {
    [...html.querySelectorAll<HTMLElement>('[role="tab"]')]
      .find((p) => p.textContent?.includes(t))!
      .click();
    await listo();
  };
  const marcar = async (t: string) => {
    [...html.querySelectorAll<HTMLElement>('mat-checkbox')]
      .find((c) => c.textContent?.includes(t))!
      .querySelector('input')!
      .click();
    await listo();
  };
  const enviar = async () => {
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    await listo();
  };
  const boton = (t: string) =>
    [...html.querySelectorAll('button')].find((b) => b.textContent?.trim().includes(t));
  return {
    html,
    texto,
    escribir,
    pestana,
    marcar,
    enviar,
    boton,
    listo,
    consultar,
    administrar,
    avisos,
    navegar,
  };
}

describe('NuevoRolComponent', () => {
  it('título, pestañas con «0 de 4» y los botones', async () => {
    const { texto, html } = await montar();
    expect(texto()).toContain('Nuevo rol');
    expect(texto()).toContain('Permisos 0 de 4');
    expect(texto()).toContain('Registrar rol');
    expect(html.querySelector('a[href="/roles"]')?.textContent).toContain('Cancelar');
  });

  it('registra con datos y permisos, avisa y abre la ficha sin dejar el alta en el historial', async () => {
    const { escribir, pestana, marcar, enviar, administrar, avisos, navegar, texto } =
      await montar();
    await escribir('nombre', 'Caja');
    await pestana('Permisos');
    await marcar('Ver roles');
    await marcar('Ver usuarios');
    expect(texto()).toContain('Permisos 2 de 4');
    // En el alta todo es nuevo: sin «Se agrega».
    expect(texto()).not.toContain('Se agrega');
    await enviar();
    expect(administrar.crear).toHaveBeenCalledWith({ nombre: 'Caja', descripcion: '' }, [
      'auth.usuario.ver',
      'auth.rol.ver',
    ]);
    expect(avisos.exito).toHaveBeenCalledWith('Rol creado');
    expect(navegar).toHaveBeenCalledWith(['/roles', 'r-9'], { replaceUrl: true });
  });

  it('sin el permiso: la casilla bloqueada', async () => {
    const { pestana, html, texto } = await montar();
    await pestana('Permisos');
    const empresa = [...html.querySelectorAll<HTMLElement>('mat-checkbox')].find((c) =>
      c.textContent?.includes('Editar la empresa'),
    );
    expect(empresa!.querySelector('input')!.disabled).toBe(true);
    expect(texto()).toContain('Usted no tiene este permiso');
  });

  it('sin nombre: no envía, vuelve a «Datos» y muestra el error', async () => {
    const { pestana, enviar, administrar, texto, html } = await montar();
    await pestana('Permisos');
    await enviar();
    expect(administrar.crear).not.toHaveBeenCalled();
    expect(texto()).toContain('Escriba el nombre del rol');
    expect(html.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
      'Datos',
    );
  });

  it('nombre repetido: el mensaje del backend arriba de los botones', async () => {
    const { escribir, enviar, administrar, html, navegar } = await montar();
    administrar.crear.mockRejectedValueOnce(
      errorHttp(TipoErrorHttp.CONFLICTO, 'Ya existe un rol con ese nombre', 409),
    );
    await escribir('nombre', 'Consulta');
    await enviar();
    expect(html.querySelector('.nuevo-rol__pie [role="alert"]')?.textContent).toContain(
      'Ya existe un rol con ese nombre',
    );
    expect(navegar).not.toHaveBeenCalled();
  });

  it('un error ya avisado (403): no lo repite', async () => {
    const { escribir, enviar, administrar, html } = await montar();
    administrar.crear.mockRejectedValueOnce(
      errorHttp(TipoErrorHttp.NO_AUTORIZADO, 'No puede dar permisos que usted no tiene', 403, true),
    );
    await escribir('nombre', 'Caja');
    await enviar();
    expect(html.querySelector('.nuevo-rol__pie [role="alert"]')?.textContent?.trim()).toBe('');
  });

  it('si no carga el catálogo: el mensaje y «Reintentar»', async () => {
    const catalogo = vi
      .fn<() => Promise<GrupoPermisos[]>>()
      .mockRejectedValueOnce(errorHttp(TipoErrorHttp.SIN_CONEXION, 'Sin conexión', 0, true))
      .mockResolvedValueOnce(catalogoDePrueba());
    const { texto, boton, listo } = await montar(catalogo);
    expect(texto()).toContain('No se pudo cargar la lista de permisos.');
    boton('Reintentar')!.click();
    await listo();
    expect(texto()).toContain('Registrar rol');
  });
});
