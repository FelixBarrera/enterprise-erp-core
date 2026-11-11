import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { ErrorHttp, TipoErrorHttp } from '../../../../../shared/domain/errors/error-http';
import { CAMBIAR_CONTRASENA_PORT } from '../../../application/ports/in/cambiar-contrasena.port';
import { CAMBIAR_EMPRESA_PORT } from '../../../application/ports/in/cambiar-empresa.port';
import { CERRAR_SESION_PORT } from '../../../application/ports/in/cerrar-sesion.port';
import { INICIAR_SESION_PORT } from '../../../application/ports/in/iniciar-sesion.port';
import { RENOVAR_SESION_PORT } from '../../../application/ports/in/renovar-sesion.port';
import { sesionDePrueba, tokenDePrueba } from '../../../application/testing/sesion-de-prueba';
import { conContrasenaCambiada, type Sesion, type SesionAbierta } from '../../../domain/sesion';
import { type MensajePestanas, Pestanas } from '../../adapters/out/navegador/pestanas';
import { Recarga } from '../../adapters/out/navegador/recarga';
import { AuthStore } from '../stores/auth.store';
import { SesionFacade } from './sesion.facade';

@Component({ template: '' })
class Vacia {}

/** Pestañas de mentira: el candado corre en orden y se anota lo avisado. */
class PestanasFalsas {
  readonly avisados: MensajePestanas[] = [];
  oyente: ((m: MensajePestanas) => void) | null = null;
  private cola: Promise<unknown> = Promise.resolve();
  conCandado<T>(tarea: () => Promise<T>): Promise<T> {
    const turno = this.cola.then(tarea);
    this.cola = turno.catch(() => undefined);
    return turno;
  }
  avisar(m: MensajePestanas): void {
    this.avisados.push(m);
  }
  alRecibir(oyente: (m: MensajePestanas) => void): void {
    this.oyente = oyente;
  }
}

function abierta(token: string, debeCambiarContrasena = false): SesionAbierta {
  const sesion = sesionDePrueba();
  return {
    token: tokenDePrueba(token),
    sesion: { ...sesion, usuario: { ...sesion.usuario, debeCambiarContrasena } },
  };
}

function montar() {
  const iniciar = {
    execute: vi.fn(() =>
      Promise.resolve({ tipo: 'sesion-iniciada' as const, sesion: abierta('del-login') }),
    ),
  };
  const renovar = {
    execute: vi.fn<() => Promise<SesionAbierta | null>>(() => Promise.resolve(abierta('nuevo'))),
  };
  const cerrar = { execute: vi.fn(() => Promise.resolve()) };
  const cambiarContrasena = {
    execute: vi.fn((_cambio: unknown, sesion: Sesion) =>
      Promise.resolve(conContrasenaCambiada(sesion)),
    ),
  };
  const cambiarEmpresa = {
    execute: vi.fn((empresaId: string) =>
      Promise.resolve(
        sesionDePrueba({
          empresaActiva: { id: empresaId, nombre: 'Empresa Dos' },
          empresas: EMPRESAS,
        }),
      ),
    ),
  };
  const pestanas = new PestanasFalsas();
  const recarga = { ir: vi.fn<(ruta: string) => void>() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'login', component: Vacia },
        { path: 'usuarios', component: Vacia },
        { path: 'contrasena-temporal', component: Vacia },
        { path: 'cambiar-contrasena', component: Vacia },
        { path: '', component: Vacia },
      ]),
      { provide: INICIAR_SESION_PORT, useValue: iniciar },
      { provide: RENOVAR_SESION_PORT, useValue: renovar },
      { provide: CERRAR_SESION_PORT, useValue: cerrar },
      { provide: CAMBIAR_CONTRASENA_PORT, useValue: cambiarContrasena },
      { provide: CAMBIAR_EMPRESA_PORT, useValue: cambiarEmpresa },
      { provide: Pestanas, useValue: pestanas },
      { provide: Recarga, useValue: recarga },
    ],
  });
  const facade = TestBed.inject(SesionFacade);
  return {
    facade,
    store: TestBed.inject(AuthStore),
    router: TestBed.inject(Router),
    iniciar,
    renovar,
    cerrar,
    cambiarContrasena,
    cambiarEmpresa,
    pestanas,
    recarga,
  };
}

const EMPRESAS = [
  { id: 'e-1', nombre: 'Empresa Uno' },
  { id: 'e-2', nombre: 'Empresa Dos' },
];

describe('SesionFacade', () => {
  it('entrar: guarda la sesión y va a la pantalla pedida', async () => {
    const { facade, store, router, iniciar } = montar();
    await facade.entrar({ nombreUsuario: 'ana', contrasena: 'x' }, '/usuarios');
    expect(iniciar.execute).toHaveBeenCalledWith({ nombreUsuario: 'ana', contrasena: 'x' });
    expect(store.token()).toBe('del-login');
    expect(router.url).toBe('/usuarios');
  });

  it('entrar con un destino de otro sitio: al inicio', async () => {
    const { facade, router } = montar();
    await facade.entrar({ nombreUsuario: 'ana', contrasena: 'x' }, '//otro-sitio.com');
    expect(router.url).toBe('/');
  });

  it('entrar con error: no guarda nada y lanza', async () => {
    const { facade, store, iniciar } = montar();
    const error = new Error('Credenciales inválidas');
    iniciar.execute.mockRejectedValueOnce(error);
    await expect(facade.entrar({ nombreUsuario: 'ana', contrasena: 'x' }, null)).rejects.toBe(
      error,
    );
    expect(store.autenticado()).toBe(false);
  });

  it('renovar: guarda el token nuevo y se lo pasa a las otras pestañas', async () => {
    const { facade, store, pestanas } = montar();
    store.fijar(abierta('viejo'));
    expect(await facade.renovar('viejo')).toBe('nuevo');
    expect(store.token()).toBe('nuevo');
    expect(pestanas.avisados).toEqual([{ tipo: 'renovada', sesion: abierta('nuevo') }]);
  });

  it('varios 401 a la vez: una sola renovación para todos', async () => {
    const { facade, store, renovar } = montar();
    store.fijar(abierta('viejo'));
    const resultados = await Promise.all([
      facade.renovar('viejo'),
      facade.renovar('viejo'),
      facade.renovar('viejo'),
    ]);
    expect(resultados).toEqual(['nuevo', 'nuevo', 'nuevo']);
    expect(renovar.execute).toHaveBeenCalledOnce();
  });

  it('si otra pestaña ya renovó mientras esperaba, usa ese token sin pedir otro', async () => {
    const { facade, store, renovar } = montar();
    store.fijar(abierta('de-otra-pestana'));
    expect(await facade.renovar('viejo')).toBe('de-otra-pestana');
    expect(renovar.execute).not.toHaveBeenCalled();
  });

  it('después de una renovación, la siguiente vuelve a pedir', async () => {
    const { facade, store, renovar } = montar();
    store.fijar(abierta('viejo'));
    await facade.renovar('viejo');
    renovar.execute.mockResolvedValueOnce(abierta('otro'));
    expect(await facade.renovar('nuevo')).toBe('otro');
    expect(renovar.execute).toHaveBeenCalledTimes(2);
  });

  it('si la sesión terminó: limpia, avisa a las otras pestañas y da null', async () => {
    const { facade, store, renovar, pestanas } = montar();
    store.fijar(abierta('viejo'));
    renovar.execute.mockResolvedValueOnce(null);
    expect(await facade.renovar('viejo')).toBeNull();
    expect(store.autenticado()).toBe(false);
    expect(pestanas.avisados).toEqual([{ tipo: 'terminada' }]);
  });

  it('sin conexión: lanza y la sesión se mantiene', async () => {
    const { facade, store, renovar, pestanas } = montar();
    store.fijar(abierta('viejo'));
    const sinRed = new ErrorHttp({
      tipo: TipoErrorHttp.SIN_CONEXION,
      mensaje: 'x',
      estado: 0,
      respondioLaApi: false,
      requestId: null,
      avisado: true,
    });
    renovar.execute.mockRejectedValueOnce(sinRed);
    await expect(facade.renovar('viejo')).rejects.toBe(sinRed);
    expect(store.token()).toBe('viejo');
    expect(pestanas.avisados).toEqual([]);
  });

  it('irAlLogin: lleva la pantalla actual para volver después', async () => {
    const { facade, router } = montar();
    await router.navigateByUrl('/usuarios');
    await facade.irAlLogin();
    expect(router.url).toBe('/login?volver=%2Fusuarios');
  });

  it('irAlLogin desde el inicio: sin volver', async () => {
    const { facade, router } = montar();
    await router.navigateByUrl('/');
    await facade.irAlLogin();
    expect(router.url).toBe('/login');
  });

  it('salir: cierra, avisa a las otras pestañas y recarga en el login', async () => {
    const { facade, cerrar, pestanas, recarga } = montar();
    await facade.salir();
    expect(cerrar.execute).toHaveBeenCalledOnce();
    expect(pestanas.avisados).toEqual([{ tipo: 'terminada' }]);
    expect(recarga.ir).toHaveBeenCalledWith('/login');
  });

  it('salir sin conexión: lanza, no avisa ni recarga (la sesión se mantiene)', async () => {
    const { facade, cerrar, pestanas, recarga } = montar();
    cerrar.execute.mockRejectedValueOnce(new Error('sin red'));
    await expect(facade.salir()).rejects.toThrow('sin red');
    expect(pestanas.avisados).toEqual([]);
    expect(recarga.ir).not.toHaveBeenCalled();
  });

  it('otra pestaña renovó: esta toma el token nuevo', () => {
    const { store, pestanas } = montar();
    store.fijar(abierta('viejo'));
    pestanas.oyente?.({ tipo: 'renovada', sesion: abierta('de-otra') });
    expect(store.token()).toBe('de-otra');
  });

  it('otra pestaña cambió la contraseña temporal: esta deja «Elija su contraseña» y sigue', async () => {
    const { store, router, pestanas } = montar();
    store.fijar(abierta('t', true));
    await router.navigateByUrl('/contrasena-temporal?volver=%2Fusuarios');
    pestanas.oyente?.({ tipo: 'renovada', sesion: abierta('t') });
    await vi.waitFor(() => expect(router.url).toBe('/usuarios'));
  });

  it('otra pestaña renovó y esta está en otra pantalla: no se mueve', async () => {
    const { store, router, pestanas } = montar();
    store.fijar(abierta('t'));
    await router.navigateByUrl('/cambiar-contrasena?volver=%2Fusuarios');
    pestanas.oyente?.({ tipo: 'renovada', sesion: abierta('otro') });
    await Promise.resolve();
    expect(router.url).toBe('/cambiar-contrasena?volver=%2Fusuarios');
  });

  it('otra pestaña renovó y esta sigue con la temporal: se queda en la pantalla', async () => {
    const { store, router, pestanas } = montar();
    store.fijar(abierta('t', true));
    await router.navigateByUrl('/contrasena-temporal');
    pestanas.oyente?.({ tipo: 'renovada', sesion: abierta('otro', true) });
    await Promise.resolve();
    expect(router.url).toBe('/contrasena-temporal');
  });

  it('cambiar la contraseña: guarda la sesión sin temporal, avisa a las pestañas y vuelve', async () => {
    const { facade, store, router, pestanas, cambiarContrasena } = montar();
    store.fijar(abierta('t', true));
    await facade.cambiarContrasena({ actual: 'Temporal-1', nueva: 'Girasol-83' }, '/usuarios');
    expect(cambiarContrasena.execute).toHaveBeenCalledWith(
      { actual: 'Temporal-1', nueva: 'Girasol-83' },
      abierta('t', true).sesion,
    );
    expect(store.debeCambiarContrasena()).toBe(false);
    expect(store.token()).toBe('t');
    expect(pestanas.avisados).toEqual([{ tipo: 'renovada', sesion: abierta('t') }]);
    expect(router.url).toBe('/usuarios');
  });

  it('cambiar la contraseña sin pantalla para volver (o de otro sitio): al inicio', async () => {
    const { facade, store, router } = montar();
    store.fijar(abierta('t'));
    await router.navigateByUrl('/usuarios');
    await facade.cambiarContrasena({ actual: 'a', nueva: 'b' }, '//otro-sitio.com');
    expect(router.url).toBe('/');
  });

  it('cambiar la contraseña con error: lanza, no avisa ni se mueve', async () => {
    const { facade, store, router, pestanas, cambiarContrasena } = montar();
    store.fijar(abierta('t', true));
    await router.navigateByUrl('/contrasena-temporal');
    const error = new Error('La contraseña actual no es correcta');
    cambiarContrasena.execute.mockRejectedValueOnce(error);
    await expect(facade.cambiarContrasena({ actual: 'a', nueva: 'b' }, null)).rejects.toBe(error);
    expect(store.debeCambiarContrasena()).toBe(true);
    expect(pestanas.avisados).toEqual([]);
    expect(router.url).toBe('/contrasena-temporal');
  });

  it('cambiar la contraseña sin sesión: lanza sin llamar al backend', async () => {
    const { facade, cambiarContrasena } = montar();
    await expect(facade.cambiarContrasena({ actual: 'a', nueva: 'b' }, null)).rejects.toThrow();
    expect(cambiarContrasena.execute).not.toHaveBeenCalled();
  });

  it('ir a cambiar la contraseña: lleva la pantalla actual para volver', async () => {
    const { facade, router } = montar();
    await router.navigateByUrl('/usuarios');
    await facade.irACambiarContrasena();
    expect(router.url).toBe('/cambiar-contrasena?volver=%2Fusuarios');
  });

  it('ir a cambiar la contraseña desde esa misma pantalla: sin volver', async () => {
    const { facade, router } = montar();
    await router.navigateByUrl('/cambiar-contrasena?volver=%2Fusuarios');
    await facade.irACambiarContrasena();
    expect(router.url).toBe('/cambiar-contrasena');
  });

  it('cambiar de empresa: la cambia, avisa a las otras pestañas y recarga en el inicio', async () => {
    const { facade, store, cambiarEmpresa, pestanas, recarga } = montar();
    store.fijar({ token: tokenDePrueba('t'), sesion: sesionDePrueba({ empresas: EMPRESAS }) });
    expect(facade.empresas()).toEqual(EMPRESAS);
    expect(facade.empresaActivaId()).toBe('e-1');
    await facade.cambiarEmpresa('e-2');
    expect(cambiarEmpresa.execute).toHaveBeenCalledWith('e-2');
    expect(store.nombreEmpresa()).toBe('Empresa Dos');
    expect(pestanas.avisados).toEqual([{ tipo: 'empresa-cambiada' }]);
    expect(recarga.ir).toHaveBeenCalledWith('/');
  });

  it('cambiar a la empresa en la que ya está: no hace nada', async () => {
    const { facade, store, cambiarEmpresa, recarga } = montar();
    store.fijar({ token: tokenDePrueba('t'), sesion: sesionDePrueba({ empresas: EMPRESAS }) });
    await facade.cambiarEmpresa('e-1');
    expect(cambiarEmpresa.execute).not.toHaveBeenCalled();
    expect(recarga.ir).not.toHaveBeenCalled();
  });

  it('cambiar de empresa con error: lanza, no avisa ni recarga', async () => {
    const { facade, store, cambiarEmpresa, pestanas, recarga } = montar();
    store.fijar({ token: tokenDePrueba('t'), sesion: sesionDePrueba({ empresas: EMPRESAS }) });
    const error = new Error('No tiene acceso a esa empresa');
    cambiarEmpresa.execute.mockRejectedValueOnce(error);
    await expect(facade.cambiarEmpresa('e-2')).rejects.toBe(error);
    expect(store.nombreEmpresa()).toBe('Empresa Uno');
    expect(pestanas.avisados).toEqual([]);
    expect(recarga.ir).not.toHaveBeenCalled();
  });

  it('otra pestaña cambió de empresa: esta recarga en el inicio', () => {
    const { store, pestanas, recarga } = montar();
    store.fijar(abierta('t'));
    pestanas.oyente?.({ tipo: 'empresa-cambiada' });
    expect(recarga.ir).toHaveBeenCalledWith('/');
  });

  it('otra pestaña cambió de empresa y esta no tenía sesión: no recarga', () => {
    const { pestanas, recarga } = montar();
    pestanas.oyente?.({ tipo: 'empresa-cambiada' });
    expect(recarga.ir).not.toHaveBeenCalled();
  });

  it('otra pestaña salió: esta limpia y recarga en el login', () => {
    const { store, pestanas, recarga } = montar();
    store.fijar(abierta('viejo'));
    pestanas.oyente?.({ tipo: 'terminada' });
    expect(store.autenticado()).toBe(false);
    expect(recarga.ir).toHaveBeenCalledWith('/login');
  });

  it('otra pestaña salió y esta no tenía sesión (está en el login): no recarga', () => {
    const { pestanas, recarga } = montar();
    pestanas.oyente?.({ tipo: 'terminada' });
    expect(recarga.ir).not.toHaveBeenCalled();
  });

  it('tiene: con el permiso en la sesión; sin sesión, ninguno; el Administrador, todos', () => {
    const { facade, store } = montar();
    expect(facade.tiene('auth.usuario.ver')).toBe(false);
    store.fijar({
      token: tokenDePrueba(),
      sesion: sesionDePrueba({ permisos: ['auth.usuario.ver'] }),
    });
    expect(facade.tiene('auth.usuario.ver')).toBe(true);
    expect(facade.tiene('auth.rol.ver')).toBe(false);
    store.fijar({ token: tokenDePrueba(), sesion: sesionDePrueba({ esAdministrador: true }) });
    expect(facade.tiene('auth.rol.ver')).toBe(true);
  });

  it('sesionLista con sesión: true sin pedir nada', async () => {
    const { facade, store, renovar } = montar();
    store.fijar(abierta('actual'));
    await expect(facade.sesionLista()).resolves.toBe(true);
    expect(renovar.execute).not.toHaveBeenCalled();
  });

  it('sesionLista al recargar: la recupera con la cookie', async () => {
    const { facade, store, renovar } = montar();
    await expect(facade.sesionLista()).resolves.toBe(true);
    expect(renovar.execute).toHaveBeenCalledTimes(1);
    expect(store.token()).toBe('nuevo');
  });

  it('sesionLista sin sesión o con contraseña temporal: false', async () => {
    const sinSesion = montar();
    sinSesion.renovar.execute.mockResolvedValue(null);
    await expect(sinSesion.facade.sesionLista()).resolves.toBe(false);
    TestBed.resetTestingModule();
    const temporal = montar();
    temporal.store.fijar(abierta('actual', true));
    await expect(temporal.facade.sesionLista()).resolves.toBe(false);
  });

  it('sesionLista sin conexión: lanza', async () => {
    const { facade, renovar } = montar();
    renovar.execute.mockRejectedValue(
      new ErrorHttp({
        tipo: TipoErrorHttp.SIN_CONEXION,
        mensaje: 'x',
        estado: 0,
        respondioLaApi: false,
        requestId: null,
        avisado: true,
      }),
    );
    await expect(facade.sesionLista()).rejects.toBeInstanceOf(ErrorHttp);
  });
});
