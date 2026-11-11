import { TestBed } from '@angular/core/testing';
import { sesionDePrueba, tokenDePrueba } from '../../../application/testing/sesion-de-prueba';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  it('empieza sin sesión', () => {
    const store = TestBed.inject(AuthStore);
    expect(store.autenticado()).toBe(false);
    expect(store.token()).toBeNull();
    expect(store.nombreCompleto()).toBeNull();
    expect(store.nombreUsuario()).toBeNull();
    expect(store.nombreEmpresa()).toBeNull();
    expect(store.empresaActivaId()).toBeNull();
    expect(store.empresas()).toEqual([]);
    expect(store.esAdministrador()).toBe(false);
    expect(store.debeCambiarContrasena()).toBe(false);
    expect(store.abierta()).toBeNull();
  });

  it('con la sesión fijada, da el token, los nombres y la empresa; al limpiar, nada', () => {
    const store = TestBed.inject(AuthStore);
    store.fijar({ token: tokenDePrueba('t-1'), sesion: sesionDePrueba({ esAdministrador: true }) });
    expect(store.autenticado()).toBe(true);
    expect(store.token()).toBe('t-1');
    expect(store.nombreCompleto()).toBe('Ana Pérez');
    expect(store.nombreUsuario()).toBe('ana.perez');
    expect(store.nombreEmpresa()).toBe('Empresa Uno');
    expect(store.empresaActivaId()).toBe('e-1');
    expect(store.empresas()).toEqual([{ id: 'e-1', nombre: 'Empresa Uno' }]);
    expect(store.esAdministrador()).toBe(true);

    expect(store.abierta()).toEqual({
      token: tokenDePrueba('t-1'),
      sesion: sesionDePrueba({ esAdministrador: true }),
    });

    store.limpiar();
    expect(store.autenticado()).toBe(false);
    expect(store.sesion()).toBeNull();
  });

  it('actualizar la sesión deja el mismo token', () => {
    const store = TestBed.inject(AuthStore);
    const temporal = sesionDePrueba({
      usuario: { ...sesionDePrueba().usuario, debeCambiarContrasena: true },
    });
    store.fijar({ token: tokenDePrueba('t-1'), sesion: temporal });
    expect(store.debeCambiarContrasena()).toBe(true);

    store.actualizarSesion(sesionDePrueba());
    expect(store.debeCambiarContrasena()).toBe(false);
    expect(store.token()).toBe('t-1');
  });
});
