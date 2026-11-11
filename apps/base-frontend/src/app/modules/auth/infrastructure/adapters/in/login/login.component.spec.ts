import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import type { Credenciales } from '../../../../domain/sesion';
import { SesionFacade } from '../../../presentation/facades/sesion.facade';
import { LoginComponent } from './login.component';

function credencialesInvalidas(): ErrorHttp {
  return new ErrorHttp({
    tipo: TipoErrorHttp.NO_AUTENTICADO,
    mensaje: 'Credenciales inválidas. Si falló varias veces, espere 15 minutos.',
    estado: 401,
    respondioLaApi: true,
    requestId: null,
    avisado: false,
  });
}

async function montar(
  entrar: (c: Credenciales, volver: string | null) => Promise<void>,
  volver: string | null = null,
) {
  const facade = { entrar: vi.fn(entrar) };
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
      ...PROVIDERS_MATERIAL,
      { provide: SesionFacade, useValue: facade },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(volver === null ? {} : { volver }) },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(LoginComponent);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const usuario = html.querySelector<HTMLInputElement>('#login-usuario')!;
  const contrasena = html.querySelector<HTMLInputElement>('#login-contrasena')!;
  const boton = html.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const escribir = (campo: HTMLInputElement, texto: string) => {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  const alerta = () => html.querySelector('[role="alert"]')?.textContent?.trim() ?? '';
  return { fixture, html, usuario, contrasena, boton, escribir, enviar, alerta, facade };
}

describe('LoginComponent', () => {
  it('muestra la marca, el formulario con sus etiquetas y el botón Ingresar', async () => {
    const { html, boton } = await montar(() => Promise.resolve());
    expect(html.querySelector('h1')?.textContent).toContain('Ingrese a su cuenta');
    expect(html.querySelector('label[for="login-usuario"]')?.textContent).toContain('Usuario');
    expect(html.querySelector('label[for="login-contrasena"]')?.textContent).toContain(
      'Contraseña',
    );
    expect(boton.textContent).toContain('Ingresar');
    expect(html.querySelector('#login-contrasena')?.getAttribute('autocomplete')).toBe(
      'current-password',
    );
  });

  it('vacío: no envía, muestra los errores y pone el foco en el primero', async () => {
    const { enviar, html, usuario, facade } = await montar(() => Promise.resolve());
    await enviar();
    expect(facade.entrar).not.toHaveBeenCalled();
    expect(html.textContent).toContain('Escriba su usuario');
    expect(html.textContent).toContain('Escriba su contraseña');
    expect(document.activeElement).toBe(usuario);
  });

  it('solo con espacios en el usuario: es obligatorio', async () => {
    const { enviar, escribir, usuario, contrasena, facade } = await montar(() => Promise.resolve());
    escribir(usuario, '   ');
    escribir(contrasena, 'secreta');
    await enviar();
    expect(facade.entrar).not.toHaveBeenCalled();
  });

  it('con usuario y contraseña: entra con lo escrito y la pantalla de volver', async () => {
    const { enviar, escribir, usuario, contrasena, facade } = await montar(
      () => Promise.resolve(),
      '/usuarios',
    );
    escribir(usuario, 'ana.perez');
    escribir(contrasena, 'secreta');
    await enviar();
    expect(facade.entrar).toHaveBeenCalledWith(
      { nombreUsuario: 'ana.perez', contrasena: 'secreta' },
      '/usuarios',
    );
  });

  it('mientras entra: el botón dice «Ingresando…», queda deshabilitado y no envía dos veces', async () => {
    let terminar: () => void = () => undefined;
    const { enviar, escribir, usuario, contrasena, boton, fixture, facade } = await montar(
      () => new Promise<void>((r) => (terminar = r)),
    );
    escribir(usuario, 'ana');
    escribir(contrasena, 'secreta');
    const html = fixture.nativeElement as HTMLElement;
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(boton.textContent).toContain('Ingresando…');
    expect(boton.getAttribute('aria-disabled')).toBe('true');
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(facade.entrar).toHaveBeenCalledOnce();
    terminar();
    await enviar();
  });

  it('con credenciales inválidas: el mensaje del backend arriba del botón y la contraseña vacía', async () => {
    const { fixture, html, enviar, escribir, usuario, contrasena, alerta } = await montar(() =>
      Promise.reject(credencialesInvalidas()),
    );
    escribir(usuario, 'ana');
    escribir(contrasena, 'mala');
    await enviar();
    expect(alerta()).toContain('Credenciales inválidas.');
    expect(contrasena.value).toBe('');
    await fixture.whenStable();
    // La contraseña vacía no se marca como error: el mensaje es el del backend.
    expect(html.textContent).not.toContain('Escriba su contraseña');
    expect(usuario.value).toBe('ana');
    expect(document.activeElement).toBe(contrasena);
  });

  it('con un error que no es de la API: un mensaje genérico', async () => {
    const { enviar, escribir, usuario, contrasena, alerta } = await montar(() =>
      Promise.reject(new Error('raro')),
    );
    escribir(usuario, 'ana');
    escribir(contrasena, 'x');
    await enviar();
    expect(alerta()).toBe('No se pudo ingresar. Intente de nuevo.');
  });

  it('el botón del ojo muestra y oculta la contraseña', async () => {
    const { html, contrasena, fixture } = await montar(() => Promise.resolve());
    const ojo = html.querySelector<HTMLButtonElement>(
      'button[aria-label="Mostrar la contraseña"]',
    )!;
    expect(contrasena.type).toBe('password');
    ojo.click();
    await fixture.whenStable();
    expect(contrasena.type).toBe('text');
    expect(ojo.getAttribute('aria-label')).toBe('Ocultar la contraseña');
    expect(ojo.getAttribute('aria-pressed')).toBe('true');
  });
});
