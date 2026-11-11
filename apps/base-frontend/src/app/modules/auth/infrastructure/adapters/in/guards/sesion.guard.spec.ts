import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { sesionDePrueba, tokenDePrueba } from '../../../../application/testing/sesion-de-prueba';
import { SesionFacade } from '../../../presentation/facades/sesion.facade';
import { AuthStore } from '../../../presentation/stores/auth.store';
import { contrasenaTemporalGuard, sesionGuard, sinSesionGuard } from './sesion.guard';

@Component({ template: '' })
class Vacia {}

function montar(renovar: () => Promise<string | null>) {
  const facade = { renovar: vi.fn(renovar) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'login', component: Vacia, canActivate: [sinSesionGuard] },
        { path: 'usuarios', component: Vacia, canActivate: [sesionGuard] },
        { path: 'contrasena-temporal', component: Vacia, canActivate: [contrasenaTemporalGuard] },
        { path: '', component: Vacia, canActivate: [sesionGuard] },
      ]),
      { provide: SesionFacade, useValue: facade },
    ],
  });
  return { router: TestBed.inject(Router), store: TestBed.inject(AuthStore), facade };
}

const conSesion = (store: AuthStore, debeCambiarContrasena = false) =>
  store.fijar({
    token: tokenDePrueba(),
    sesion: sesionDePrueba({ usuario: { ...sesionDePrueba().usuario, debeCambiarContrasena } }),
  });

describe('sesionGuard', () => {
  it('con sesión, deja pasar sin pedir nada', async () => {
    const { router, store, facade } = montar(() => Promise.resolve(null));
    conSesion(store);
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/usuarios');
    expect(facade.renovar).not.toHaveBeenCalled();
  });

  it('al recargar (sin token), la recupera con la cookie y deja pasar', async () => {
    const { router, facade } = montar(() => Promise.resolve('nuevo'));
    await router.navigateByUrl('/usuarios');
    expect(facade.renovar).toHaveBeenCalledWith(null);
    expect(router.url).toBe('/usuarios');
  });

  it('sin sesión, al login con la pantalla para volver', async () => {
    const { router } = montar(() => Promise.resolve(null));
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/login?volver=%2Fusuarios');
  });

  it('sin sesión desde el inicio, al login sin volver', async () => {
    const { router } = montar(() => Promise.resolve(null));
    await router.navigateByUrl('/');
    expect(router.url).toBe('/login');
  });

  it('sin conexión para recuperarla, al login', async () => {
    const { router } = montar(() => Promise.reject(new Error('sin red')));
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/login?volver=%2Fusuarios');
  });

  it('con contraseña temporal, primero a cambiarla (con la pantalla para volver)', async () => {
    const { router, store } = montar(() => Promise.resolve(null));
    conSesion(store, true);
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/contrasena-temporal?volver=%2Fusuarios');
  });

  it('al recargar con contraseña temporal, también a cambiarla', async () => {
    const { router, store, facade } = montar(() => Promise.resolve(null));
    facade.renovar.mockImplementation(() => {
      conSesion(store, true);
      return Promise.resolve('nuevo');
    });
    await router.navigateByUrl('/');
    expect(router.url).toBe('/contrasena-temporal');
  });
});

describe('contrasenaTemporalGuard', () => {
  it('con contraseña temporal, muestra la pantalla', async () => {
    const { router, store } = montar(() => Promise.resolve(null));
    conSesion(store, true);
    await router.navigateByUrl('/contrasena-temporal?volver=%2Fusuarios');
    expect(router.url).toBe('/contrasena-temporal?volver=%2Fusuarios');
  });

  it('si ya no es temporal, a la pantalla que pedía', async () => {
    const { router, store } = montar(() => Promise.resolve(null));
    conSesion(store);
    await router.navigateByUrl('/contrasena-temporal?volver=%2Fusuarios');
    expect(router.url).toBe('/usuarios');
  });

  it('si ya no es temporal y pedía otro sitio, al inicio', async () => {
    const { router, store } = montar(() => Promise.resolve(null));
    conSesion(store);
    await router.navigateByUrl('/contrasena-temporal?volver=%2F%2Fotro-sitio.com');
    expect(router.url).toBe('/');
  });

  it('sin sesión, al login (y después, a la pantalla que pedía)', async () => {
    const { router } = montar(() => Promise.resolve(null));
    await router.navigateByUrl('/contrasena-temporal?volver=%2Fusuarios');
    expect(router.url).toBe('/login?volver=%2Fusuarios');
  });

  it('sin sesión ni pantalla pedida, al login sin volver', async () => {
    const { router } = montar(() => Promise.reject(new Error('sin red')));
    await router.navigateByUrl('/contrasena-temporal');
    expect(router.url).toBe('/login');
  });
});

describe('sinSesionGuard', () => {
  it('sin sesión, muestra el login', async () => {
    const { router } = montar(() => Promise.resolve(null));
    await router.navigateByUrl('/login');
    expect(router.url).toBe('/login');
  });

  it('con sesión, va a la pantalla pedida', async () => {
    const { router, store } = montar(() => Promise.resolve(null));
    conSesion(store);
    await router.navigateByUrl('/login?volver=%2Fusuarios');
    expect(router.url).toBe('/usuarios');
  });

  it('si la cookie todavía sirve, entra sin escribir la contraseña', async () => {
    const { router } = montar(() => Promise.resolve('nuevo'));
    await router.navigateByUrl('/login');
    expect(router.url).toBe('/');
  });

  it('sin conexión, muestra el login', async () => {
    const { router } = montar(() => Promise.reject(new Error('sin red')));
    await router.navigateByUrl('/login');
    expect(router.url).toBe('/login');
  });
});
