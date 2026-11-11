import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import type { CambioContrasena } from '../../../../domain/sesion';
import { SesionFacade } from '../../../presentation/facades/sesion.facade';
import { CambiarContrasenaComponent } from './cambiar-contrasena.component';

function rechazo(mensaje: string, estado = 400): ErrorHttp {
  return new ErrorHttp({
    tipo: estado === 403 ? TipoErrorHttp.NO_AUTORIZADO : TipoErrorHttp.VALIDACION,
    mensaje,
    estado,
    respondioLaApi: true,
    requestId: null,
    avisado: false,
  });
}

interface Opciones {
  temporal?: boolean;
  volver?: string | null;
  cambiar?: (c: CambioContrasena, volver: string | null) => Promise<void>;
  salir?: () => Promise<void>;
}

async function montar(opciones: Opciones = {}) {
  const { temporal = false, volver = null } = opciones;
  const facade = {
    nombreCompleto: signal<string | null>('Ana Pérez'),
    cambiarContrasena: vi.fn(opciones.cambiar ?? (() => Promise.resolve())),
    salir: vi.fn(opciones.salir ?? (() => Promise.resolve())),
  };
  const avisos = { exito: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    imports: [CambiarContrasenaComponent],
    providers: [
      ...PROVIDERS_MATERIAL,
      provideRouter([]),
      { provide: SesionFacade, useValue: facade },
      { provide: NotificacionesService, useValue: avisos },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            data: { temporal },
            queryParamMap: convertToParamMap(volver === null ? {} : { volver }),
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(CambiarContrasenaComponent);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const campo = (id: string) => html.querySelector<HTMLInputElement>(`#cambio-${id}`)!;
  const listo = () => fixture.whenStable();
  const escribir = async (id: string, texto: string) => {
    campo(id).value = texto;
    campo(id).dispatchEvent(new Event('input'));
    await listo();
  };
  const llenar = async (actual: string, nueva: string, repetir = nueva) => {
    await escribir('actual', actual);
    await escribir('nueva', nueva);
    await escribir('repetir', repetir);
  };
  const enviar = async () => {
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    await listo();
  };
  const texto = () => html.textContent ?? '';
  const alerta = () => html.querySelector('[role="alert"]')?.textContent?.trim() ?? '';
  const boton = () => html.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  return {
    fixture,
    html,
    campo,
    escribir,
    llenar,
    enviar,
    texto,
    alerta,
    boton,
    listo,
    facade,
    avisos,
  };
}

describe('CambiarContrasenaComponent', () => {
  describe('con la contraseña temporal', () => {
    it('sin menú: la marca, «Salir», el saludo y «Guardar y continuar»', async () => {
      const { html, texto, boton } = await montar({ temporal: true });
      expect(html.querySelector('main app-marca, header app-marca')).not.toBeNull();
      expect(html.querySelector('h1')?.textContent).toContain('Elija su contraseña');
      expect(texto()).toContain('Ana Pérez, el administrador le dio una contraseña temporal');
      expect(html.querySelector('label[for="cambio-actual"]')?.textContent).toContain(
        'Contraseña temporal',
      );
      expect(boton().textContent).toContain('Guardar y continuar');
      expect(html.querySelector('.cambio__cancelar')).toBeNull();
    });

    it('«Salir» cierra la sesión una sola vez y queda «Saliendo…»', async () => {
      const { html, facade, listo } = await montar({
        temporal: true,
        salir: () => new Promise<void>(() => undefined),
      });
      const salir = html.querySelector<HTMLButtonElement>('.cabecera-sola__salir')!;
      salir.click();
      salir.click();
      await listo();
      expect(facade.salir).toHaveBeenCalledOnce();
      expect(salir.textContent).toContain('Saliendo…');
    });

    it('si salir falla (sin conexión), «Salir» vuelve a estar disponible', async () => {
      const { html, listo } = await montar({
        temporal: true,
        salir: () => Promise.reject(new Error('sin red')),
      });
      const salir = html.querySelector<HTMLButtonElement>('.cabecera-sola__salir')!;
      salir.click();
      await listo();
      await listo();
      expect(salir.textContent).toContain('Salir');
      expect(salir.textContent).not.toContain('Saliendo…');
    });
  });

  describe('la voluntaria', () => {
    it('dentro del layout: título, «Contraseña actual» y «Cancelar» a la pantalla de antes', async () => {
      const { html, boton } = await montar({ volver: '/usuarios?pagina=2' });
      expect(html.querySelector('h1')?.textContent).toContain('Cambiar contraseña');
      expect(html.querySelector('.cabecera-sola')).toBeNull();
      expect(html.querySelector('label[for="cambio-actual"]')?.textContent).toContain(
        'Contraseña actual',
      );
      expect(boton().textContent).toContain('Guardar contraseña');
      expect(html.querySelector('.cambio__cancelar')?.getAttribute('href')).toBe(
        '/usuarios?pagina=2',
      );
    });

    it('«Cancelar» con un destino de otro sitio va al inicio', async () => {
      const { html } = await montar({ volver: '//otro-sitio.com' });
      expect(html.querySelector('.cambio__cancelar')?.getAttribute('href')).toBe('/');
    });
  });

  it('vacío: los tres errores y el foco en el primero, sin llamar al backend', async () => {
    const { texto, enviar, campo, facade } = await montar();
    await enviar();
    expect(texto()).toContain('Escriba su contraseña actual');
    expect(texto()).toContain('Escriba la contraseña nueva');
    expect(texto()).toContain('Repita la contraseña nueva');
    expect(document.activeElement).toBe(campo('actual'));
    expect(facade.cambiarContrasena).not.toHaveBeenCalled();
  });

  it('nueva corta: su error y el foco en ella', async () => {
    const { texto, llenar, enviar, campo, facade } = await montar();
    await llenar('Actual-1', 'corta');
    await enviar();
    expect(texto()).toContain('Debe tener entre 8 y 128 caracteres');
    expect(document.activeElement).toBe(campo('nueva'));
    expect(facade.cambiarContrasena).not.toHaveBeenCalled();
  });

  it('las dos distintas: «no coinciden» y el foco en la repetida', async () => {
    const { texto, llenar, enviar, campo, facade } = await montar();
    await llenar('Actual-1', 'Girasol-Martes-83', 'Girasol-Martes-8');
    await enviar();
    expect(texto()).toContain('Las dos contraseñas no coinciden');
    expect(document.activeElement).toBe(campo('repetir'));
    expect(facade.cambiarContrasena).not.toHaveBeenCalled();
  });

  it('si después se corrige la nueva para que coincida, el error de la repetida se va', async () => {
    const { llenar, escribir, enviar, facade } = await montar();
    await llenar('Actual-1', 'Girasol-Martes-8', 'Girasol-Martes-83');
    await escribir('nueva', 'Girasol-Martes-83');
    await enviar();
    expect(facade.cambiarContrasena).toHaveBeenCalledOnce();
  });

  it('la barra y la lista se mueven mientras escribe', async () => {
    const { html, texto, escribir } = await montar();
    const cumplidas = () => html.querySelectorAll('.regla--cumplida').length;
    expect(texto()).toContain('Escriba al menos 8 caracteres');
    expect(cumplidas()).toBe(0);

    await escribir('nueva', 'Girasol-Martes-83');
    expect(html.querySelector('.fuerza')?.getAttribute('data-nivel')).toBe('4');
    expect(html.querySelectorAll('.fuerza__raya--llena')).toHaveLength(4);
    expect(texto()).toContain('Muy buena');
    expect(cumplidas()).toBe(1);

    await escribir('repetir', 'Girasol-Martes-83');
    expect(cumplidas()).toBe(2);
  });

  it('«Mostrar las contraseñas nuevas» muestra las dos (no la actual)', async () => {
    const { html, campo, listo } = await montar();
    const ver = html.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    expect(ver.getAttribute('aria-label')).toBe('Mostrar las contraseñas nuevas');
    ver.click();
    await listo();
    expect(campo('nueva').type).toBe('text');
    expect(campo('repetir').type).toBe('text');
    expect(campo('actual').type).toBe('password');
    expect(ver.getAttribute('aria-pressed')).toBe('true');
  });

  it('guardar: manda la actual y la nueva con el destino, y avisa', async () => {
    const { llenar, enviar, facade, avisos } = await montar({ temporal: true, volver: '/roles' });
    await llenar('Temporal-1', 'Girasol-Martes-83');
    await enviar();
    expect(facade.cambiarContrasena).toHaveBeenCalledWith(
      { actual: 'Temporal-1', nueva: 'Girasol-Martes-83' },
      '/roles',
    );
    expect(avisos.exito).toHaveBeenCalledWith('Contraseña cambiada');
  });

  it('mientras guarda: «Guardando…» y un segundo envío no hace nada', async () => {
    const { llenar, enviar, boton, facade } = await montar({
      cambiar: () => new Promise<void>(() => undefined),
    });
    await llenar('Actual-1', 'Girasol-Martes-83');
    await enviar();
    await enviar();
    expect(boton().textContent).toContain('Guardando…');
    expect(facade.cambiarContrasena).toHaveBeenCalledOnce();
  });

  it('el backend la rechaza: su mensaje arriba del botón y no avisa', async () => {
    const { llenar, enviar, alerta, boton, avisos } = await montar({
      cambiar: () => Promise.reject(rechazo('La contraseña es demasiado común')),
    });
    await llenar('Actual-1', 'Password123');
    await enviar();
    expect(alerta()).toContain('La contraseña es demasiado común');
    expect(boton().textContent).toContain('Guardar contraseña');
    expect(avisos.exito).not.toHaveBeenCalled();
  });

  it('cuenta bloqueada (403): también lo dice la pantalla', async () => {
    const { llenar, enviar, alerta } = await montar({
      cambiar: () =>
        Promise.reject(rechazo('Demasiados intentos fallidos. Espere 15 minutos.', 403)),
    });
    await llenar('mala-mala', 'Girasol-Martes-83');
    await enviar();
    expect(alerta()).toContain('Demasiados intentos fallidos');
  });

  it('un error que no es del backend: un mensaje general', async () => {
    const { llenar, enviar, alerta } = await montar({
      cambiar: () => Promise.reject(new Error('raro')),
    });
    await llenar('Actual-1', 'Girasol-Martes-83');
    await enviar();
    expect(alerta()).toContain('No se pudo cambiar la contraseña. Intente de nuevo.');
  });

  it('al volver a enviar, el mensaje anterior se borra', async () => {
    const cambiar = vi
      .fn<(c: CambioContrasena, v: string | null) => Promise<void>>()
      .mockRejectedValueOnce(rechazo('La contraseña actual no es correcta'))
      .mockResolvedValueOnce(undefined);
    const { llenar, enviar, alerta } = await montar({ cambiar });
    await llenar('mala-mala', 'Girasol-Martes-83');
    await enviar();
    expect(alerta()).toContain('no es correcta');
    await enviar();
    expect(alerta()).toBe('');
  });
});
