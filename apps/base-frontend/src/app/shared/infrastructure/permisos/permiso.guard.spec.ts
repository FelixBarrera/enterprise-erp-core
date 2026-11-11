import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NotificacionesService } from '../avisos/notificaciones.service';
import { MENSAJE_SIN_PERMISO_PANTALLA, permisoGuard } from './permiso.guard';
import { PermisosDePrueba } from './permisos-de-prueba';
import { PERMISOS_SESION } from './permisos-sesion';

@Component({ template: '' })
class Vacia {}

function montar(permisos: PermisosDePrueba) {
  const avisos = { error: vi.fn(() => Promise.resolve()) };
  // La pantalla se descarga solo si el guard la deja pasar.
  const descargar = vi.fn(() => Promise.resolve(Vacia));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'usuarios',
          canMatch: [permisoGuard('auth.usuario.ver')],
          loadComponent: descargar,
        },
        { path: '', component: Vacia },
      ]),
      { provide: PERMISOS_SESION, useValue: permisos },
      { provide: NotificacionesService, useValue: avisos },
    ],
  });
  return { router: TestBed.inject(Router), avisos, descargar };
}

describe('permisoGuard', () => {
  it('con el permiso, deja pasar y descarga la pantalla', async () => {
    const { router, avisos, descargar } = montar(new PermisosDePrueba(['auth.usuario.ver']));
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/usuarios');
    expect(descargar).toHaveBeenCalled();
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('sin el permiso, avisa y lleva al inicio sin descargar la pantalla', async () => {
    const { router, avisos, descargar } = montar(new PermisosDePrueba(['auth.rol.ver']));
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/');
    expect(avisos.error).toHaveBeenCalledWith(MENSAJE_SIN_PERMISO_PANTALLA);
    expect(descargar).not.toHaveBeenCalled();
  });

  it('espera a recuperar la sesión (al recargar la página) antes de mirar el permiso', async () => {
    const permisos = new PermisosDePrueba([], async () => {
      permisos.fijar(['auth.usuario.ver']);
      return true;
    });
    const { router } = montar(permisos);
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/usuarios');
  });

  it('sin sesión (o con contraseña temporal), deja seguir: el guard de sesión se encarga', async () => {
    const { router, avisos } = montar(new PermisosDePrueba([], () => Promise.resolve(false)));
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/usuarios');
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('sin conexión al recuperar la sesión, deja seguir sin otro aviso', async () => {
    const { router, avisos } = montar(
      new PermisosDePrueba([], () => Promise.reject(new Error('sin conexión'))),
    );
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/usuarios');
    expect(avisos.error).not.toHaveBeenCalled();
  });
});
