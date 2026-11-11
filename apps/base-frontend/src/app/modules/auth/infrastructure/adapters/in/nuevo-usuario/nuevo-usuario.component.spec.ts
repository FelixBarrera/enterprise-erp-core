import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { MENU_APLICACION } from '../../../../../../shared/infrastructure/layout/menu';
import { USUARIO_CABECERA } from '../../../../../../shared/infrastructure/layout/usuario-cabecera';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import { ADMINISTRAR_USUARIOS_PORT } from '../../../../application/ports/in/administrar-usuarios.port';
import { CONSULTAR_USUARIOS_PORT } from '../../../../application/ports/in/consultar-usuarios.port';
import { sesionDePrueba } from '../../../../application/testing/sesion-de-prueba';
import {
  rolesAsignablesDePrueba,
  usuarioDePrueba,
} from '../../../../application/testing/usuarios-de-prueba';
import type { RolAsignable } from '../../../../domain/usuario';
import { AuthStore } from '../../../presentation/stores/auth.store';
import { ContrasenaTemporalService } from '../contrasena-temporal/contrasena-temporal.service';
import { NuevoUsuarioComponent } from './nuevo-usuario.component';

function errorHttp(tipo: TipoErrorHttp, mensaje: string, estado: number, avisado = false) {
  return new ErrorHttp({ tipo, mensaje, estado, respondioLaApi: true, requestId: null, avisado });
}

interface Opciones {
  asignables?: () => Promise<RolAsignable[]>;
  esAdministrador?: boolean;
  empresa?: string;
}

async function montar(opciones: Opciones = {}) {
  const consultar = {
    listar: vi.fn(),
    ver: vi.fn(),
    rolesAsignables: vi.fn(
      opciones.asignables ?? (() => Promise.resolve(rolesAsignablesDePrueba())),
    ),
  };
  const administrar = {
    guardar: vi.fn(),
    quitarAcceso: vi.fn(),
    crear: vi.fn(() =>
      Promise.resolve({
        usuario: usuarioDePrueba({ id: 'u-9', nombreUsuario: 'lucia.torres' }),
        contrasenaTemporal: 'k7Rm3xTq9vWb',
      }),
    ),
  };
  const avisos = { exito: vi.fn(() => Promise.resolve()), error: vi.fn(() => Promise.resolve()) };
  const contrasena = { mostrar: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    imports: [NuevoUsuarioComponent],
    providers: [
      ...PROVIDERS_MATERIAL,
      provideRouter([]),
      { provide: MENU_APLICACION, useValue: [] },
      { provide: CONSULTAR_USUARIOS_PORT, useValue: consultar },
      { provide: ADMINISTRAR_USUARIOS_PORT, useValue: administrar },
      { provide: NotificacionesService, useValue: avisos },
      { provide: ContrasenaTemporalService, useValue: contrasena },
      {
        provide: AuthStore,
        useValue: {
          sesion: signal(sesionDePrueba({ esAdministrador: opciones.esAdministrador ?? false })),
        },
      },
      {
        provide: USUARIO_CABECERA,
        useValue: { nombreEmpresa: signal(opciones.empresa ?? 'Comercial Ejemplo') },
      },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(NuevoUsuarioComponent);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const listo = () => fixture.whenStable();
  const texto = () => (html.textContent ?? '').replace(/\s+/gu, ' ');
  const campo = (id: 'usuario' | 'nombre') =>
    html.querySelector<HTMLInputElement>(`#nuevo-usuario-${id}`);
  const escribir = async (id: 'usuario' | 'nombre', valor: string) => {
    campo(id)!.value = valor;
    campo(id)!.dispatchEvent(new Event('input'));
    await listo();
  };
  const casilla = (t: string) =>
    [...html.querySelectorAll<HTMLElement>('.editor-roles__rol')].find((c) =>
      c.querySelector('mat-checkbox')?.textContent?.includes(t),
    );
  const marcar = async (t: string) => {
    casilla(t)!.querySelector('input')!.click();
    await listo();
  };
  const enviar = async () => {
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    await listo();
  };
  const boton = (t: string) =>
    [...html.querySelectorAll('button')].find((b) => b.textContent?.trim().includes(t));
  const alerta = () => html.querySelector('.nuevo-usuario__pie [role="alert"]')?.textContent ?? '';
  return {
    html,
    texto,
    campo,
    escribir,
    casilla,
    marcar,
    enviar,
    boton,
    alerta,
    listo,
    consultar,
    administrar,
    avisos,
    contrasena,
    navegar,
  };
}

describe('NuevoUsuarioComponent', () => {
  it('una empresa cuyo nombre termina en punto no deja dos puntos seguidos', async () => {
    const { texto } = await montar({ empresa: 'Comercial Ejemplo S.A.' });
    expect(texto()).toContain('al menos un rol en Comercial Ejemplo S.A.');
    expect(texto()).not.toContain('S.A..');
  });

  it('una persona nueva: los dos campos y los roles de la empresa, sin elegir a alguien existente', async () => {
    const { texto, campo, html } = await montar();
    expect(texto()).toContain('Nuevo usuario');
    expect(texto()).toContain(
      'Se crea con una contraseña temporal y al menos un rol en Comercial Ejemplo.',
    );
    expect(texto()).not.toContain('¿A quién le da acceso?');
    expect(texto()).not.toContain('Alguien que ya tiene usuario');
    expect(html.querySelector('input[type="radio"]')).toBeNull();
    expect(campo('usuario')).not.toBeNull();
    expect(campo('nombre')).not.toBeNull();
    expect(texto()).toContain('Roles en Comercial Ejemplo');
    expect(texto()).toContain('Elija al menos un rol.');
    expect(texto()).toContain('Registrar usuario');
    expect(html.querySelector('a[href="/usuarios"]')?.textContent).toContain('Cancelar');
  });

  it('crea, muestra la contraseña temporal y luego abre su ficha sin dejar el alta en el historial', async () => {
    const { escribir, marcar, enviar, administrar, contrasena, navegar, texto } = await montar();
    await escribir('usuario', 'Lucia.Torres');
    await escribir('nombre', 'Lucía Torres');
    await marcar('Soporte');
    await marcar('Consulta');
    // En el alta todo es nuevo: sin «Se agrega».
    expect(texto()).not.toContain('Se agrega');
    expect(texto()).not.toContain('Elija al menos un rol.');
    await enviar();
    expect(administrar.crear).toHaveBeenCalledWith({
      nombreUsuario: 'Lucia.Torres',
      nombreCompleto: 'Lucía Torres',
      // En el orden de la lista, no en el que se marcaron.
      roles: ['r-consulta', 'r-soporte'],
    });
    expect(contrasena.mostrar).toHaveBeenCalledWith({
      titulo: 'Usuario creado',
      nombreUsuario: 'lucia.torres',
      contrasena: 'k7Rm3xTq9vWb',
      textoListo: 'Listo, ir a su ficha',
    });
    expect(contrasena.mostrar.mock.invocationCallOrder[0]).toBeLessThan(
      navegar.mock.invocationCallOrder[0],
    );
    expect(navegar).toHaveBeenCalledWith(['/usuarios', 'u-9'], { replaceUrl: true });
  });

  it('ya creado: no se puede registrar otra vez mientras se ve la contraseña', async () => {
    const { escribir, marcar, enviar, administrar, contrasena, boton } = await montar();
    contrasena.mostrar.mockReturnValueOnce(new Promise(() => undefined));
    await escribir('usuario', 'lucia.torres');
    await escribir('nombre', 'Lucía Torres');
    await marcar('Consulta');
    await enviar();
    await enviar();
    expect(administrar.crear).toHaveBeenCalledTimes(1);
    expect(boton('Registrando…')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('campos vacíos o mal escritos: no envía y lo dice en cada campo', async () => {
    const { enviar, escribir, texto, administrar, campo } = await montar();
    await enviar();
    expect(texto()).toContain('Escriba el nombre de usuario');
    expect(texto()).toContain('Escriba el nombre completo');
    expect(document.activeElement).toBe(campo('usuario'));
    await escribir('usuario', 'lucía');
    expect(texto()).toContain('Debe tener de 3 a 50 caracteres');
    expect(administrar.crear).not.toHaveBeenCalled();
  });

  it('sin ningún rol: no envía y lo dice arriba de los botones', async () => {
    const { escribir, enviar, administrar, alerta } = await montar();
    await escribir('usuario', 'lucia.torres');
    await escribir('nombre', 'Lucía Torres');
    await enviar();
    expect(administrar.crear).not.toHaveBeenCalled();
    expect(alerta()).toContain('Elija al menos un rol.');
  });

  it('escalada en la pantalla: lo que no puede dar, bloqueado con el motivo', async () => {
    const { casilla, texto } = await montar();
    expect(casilla('Administrador')!.querySelector('input')!.disabled).toBe(true);
    expect(casilla('Cumplimiento')!.querySelector('input')!.disabled).toBe(true);
    expect(casilla('Consulta')!.querySelector('input')!.disabled).toBe(false);
    expect(texto()).toContain('Solo un administrador da este rol');
    expect(texto()).toContain('Usted no tiene todos los permisos de este rol');
  });

  it('nombre de usuario repetido: pide otro y deja lo escrito para corregirlo', async () => {
    const { escribir, marcar, enviar, administrar, alerta, campo, navegar, html } = await montar();
    administrar.crear.mockRejectedValueOnce(
      errorHttp(TipoErrorHttp.CONFLICTO, 'Ese nombre de usuario ya existe', 409),
    );
    await escribir('usuario', 'jorge.vera');
    await escribir('nombre', 'Jorge Vera');
    await marcar('Consulta');
    await enviar();
    expect(alerta()).toContain(
      'Ese nombre de usuario ya existe (aunque esté desactivado, no se vuelve a usar). Elija otro.',
    );
    expect(html.querySelector('.nuevo-usuario__pie [role="alert"] button')).toBeNull();
    expect(navegar).not.toHaveBeenCalled();
    expect(campo('usuario')!.value).toBe('jorge.vera');
    expect(campo('nombre')!.value).toBe('Jorge Vera');
    // Corrige el nombre y vuelve a registrar: el aviso se va.
    await escribir('usuario', 'jorge.vera2');
    await enviar();
    expect(administrar.crear).toHaveBeenCalledTimes(2);
    expect(alerta()).not.toContain('Ese nombre de usuario ya existe');
  });

  it('otro error con mensaje (422): el del backend', async () => {
    const { escribir, marcar, enviar, administrar, alerta } = await montar();
    administrar.crear.mockRejectedValueOnce(
      errorHttp(TipoErrorHttp.REGLA_NEGOCIO, 'No se puede dar un rol desactivado', 422),
    );
    await escribir('usuario', 'lucia.torres');
    await escribir('nombre', 'Lucía Torres');
    await marcar('Consulta');
    await enviar();
    expect(alerta()).toContain('No se puede dar un rol desactivado');
  });

  it('un error ya avisado (403): no lo repite y deja volver a intentar', async () => {
    const { escribir, marcar, enviar, administrar, alerta, boton } = await montar();
    administrar.crear.mockRejectedValueOnce(
      errorHttp(TipoErrorHttp.NO_AUTORIZADO, 'No puede dar permisos que usted no tiene', 403, true),
    );
    await escribir('usuario', 'lucia.torres');
    await escribir('nombre', 'Lucía Torres');
    await marcar('Consulta');
    await enviar();
    expect(alerta().trim()).toBe('');
    expect(boton('Registrar usuario')).toBeDefined();
  });

  it('un administrador puede dar el rol Administrador', async () => {
    const { casilla } = await montar({
      esAdministrador: true,
      asignables: () =>
        Promise.resolve(
          rolesAsignablesDePrueba().map((r) =>
            r.esAdministrador ? { ...r, sePuedeDar: true } : r,
          ),
        ),
    });
    expect(casilla('Administrador')!.querySelector('input')!.disabled).toBe(false);
  });

  it('si no cargan los roles: el mensaje y «Reintentar»', async () => {
    const asignables = vi
      .fn<() => Promise<RolAsignable[]>>()
      .mockRejectedValueOnce(errorHttp(TipoErrorHttp.SIN_CONEXION, 'Sin conexión', 0, true))
      .mockResolvedValueOnce(rolesAsignablesDePrueba());
    const { texto, boton, listo } = await montar({ asignables });
    expect(texto()).toContain('No se pudo cargar la lista de roles.');
    boton('Reintentar')!.click();
    await listo();
    expect(texto()).toContain('Registrar usuario');
  });
});
