import { BreakpointObserver } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { ZONA_NEGOCIO } from '../../../../../../shared/infrastructure/fechas/zona-negocio';
import { MENU_APLICACION } from '../../../../../../shared/infrastructure/layout/menu';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import { PermisosDePrueba } from '../../../../../../shared/infrastructure/permisos/permisos-de-prueba';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { CONSULTAR_BITACORA_PORT } from '../../../../application/ports/in/consultar-bitacora.port';
import { detalleDePrueba } from '../../../../application/testing/eventos-de-prueba';
import type { EventoDetalle } from '../../../../domain/evento';
import { DetalleEventoComponent } from './detalle-evento.component';

const JORGE = '0190a4f2-1c2b-7000-8000-000000000102';

interface Opciones {
  evento?: EventoDetalle;
  ver?: () => Promise<EventoDetalle>;
  permisos?: string[];
  descripciones?: () => Promise<ReadonlyMap<string, string>>;
  celular?: boolean;
}

async function montar(opciones: Opciones = {}) {
  const evento = opciones.evento ?? detalleDePrueba();
  const consultar = {
    listar: vi.fn(),
    usuarios: vi.fn(),
    ver: vi.fn(opciones.ver ?? (() => Promise.resolve(evento))),
    descripcionesPermisos: vi.fn(
      opciones.descripciones ??
        (() => Promise.resolve(new Map([['auth.usuario.ver', 'Ver usuarios']]))),
    ),
  };
  TestBed.configureTestingModule({
    imports: [DetalleEventoComponent],
    providers: [
      ...PROVIDERS_MATERIAL,
      provideRouter([]),
      { provide: MENU_APLICACION, useValue: [] },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: evento.id })) } },
      { provide: CONSULTAR_BITACORA_PORT, useValue: consultar },
      { provide: ZONA_NEGOCIO, useValue: signal('America/Guayaquil') },
      {
        provide: PERMISOS_SESION,
        useValue: new PermisosDePrueba(opciones.permisos ?? ['auth.usuario.ver', 'auth.rol.ver']),
      },
      ...(opciones.celular
        ? [
            {
              provide: BreakpointObserver,
              useValue: { observe: () => of({ matches: true }), isMatched: () => true },
            },
          ]
        : []),
    ],
  });
  const fixture = TestBed.createComponent(DetalleEventoComponent);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const texto = () => (html.textContent ?? '').replace(/\s+/gu, ' ');
  const dato = (nombre: string) =>
    [...html.querySelectorAll('.detalle-evento__lista-datos dt')]
      .find((dt) => dt.textContent?.trim() === nombre)
      ?.nextElementSibling?.textContent?.replace(/\s+/gu, ' ')
      .trim() ?? null;
  return { fixture, html, texto, dato, consultar, listo: () => fixture.whenStable() };
}

function errorHttp(tipo: TipoErrorHttp, mensaje: string, estado: number) {
  return new ErrorHttp({
    tipo,
    mensaje,
    estado,
    respondioLaApi: true,
    requestId: null,
    avisado: false,
  });
}

describe('DetalleEventoComponent', () => {
  it('el evento: qué hizo, cuándo y quién', async () => {
    const { html, texto, consultar } = await montar();
    expect(consultar.ver).toHaveBeenCalledWith(detalleDePrueba().id);
    expect(html.querySelector('h1')?.textContent).toContain('Cambió los roles de un usuario');
    expect(texto()).toContain('El 07/11/2026 10:42 por ana.perez');
    expect(html.querySelector('.estado--peligro')).toBeNull();
  });

  it('qué cambió: los roles, con lo que se agregó y lo que se quitó', async () => {
    const { html, texto } = await montar();
    expect(texto()).toContain('Solo los datos que cambiaron.');
    const fila = html.querySelector('.detalle-evento__tabla tbody tr')!;
    expect(fila.querySelector('th')?.textContent?.trim()).toBe('Roles');
    const [antes, despues] = [...fila.querySelectorAll('td')];
    const quitado = antes.querySelector('.valor-cambio__etiqueta--quita')?.textContent;
    expect(quitado?.replace(/\s+/gu, ' ').trim()).toBe('Se quitó: Operaciones');
    const agregado = despues.querySelector('.valor-cambio__etiqueta--agrega')?.textContent;
    expect(agregado?.replace(/\s+/gu, ' ').trim()).toBe('+Se agregó: Cumplimiento');
    expect(despues.querySelectorAll('.valor-cambio__etiqueta')).toHaveLength(2);
    expect(texto()).toContain('Se agregó Se quitó');
  });

  it('datos del evento, con su ficha, su historia y la hora con segundos', async () => {
    const { html, dato } = await montar();
    expect(dato('Quién')).toBe('ana.perez');
    expect(dato('Cuándo')).toBe('07/11/2026 10:42:00');
    expect(dato('Desde dónde')).toBe('10.0.0.7');
    expect(dato('Con qué')).toContain('Chrome/142.0');
    expect(dato('N.º de petición')).toContain('5f2c9a1e-7d43-4b8a-9c11-0e6b2f8d4a70');
    const enlaces = [...html.querySelectorAll<HTMLAnchorElement>('.detalle-evento__enlaces a')];
    expect(enlaces.map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Ver su ficha', `/usuarios/${JORGE}`],
      ['Ver su historia', `/bitacora?entidad=usuario&entidadId=${JORGE}`],
    ]);
  });

  it('sin el permiso de ver usuarios, sin «Ver su ficha»', async () => {
    const { texto } = await montar({ permisos: [] });
    expect(texto()).not.toContain('Ver su ficha');
    expect(texto()).toContain('Ver su historia');
  });

  it('un proceso del sistema, sin cambios ni desde dónde', async () => {
    const { texto, dato, html } = await montar({
      evento: detalleDePrueba({
        usuarioId: null,
        nombreUsuario: null,
        accion: 'auth.sesion.iniciar',
        entidad: 'sesion',
        entidadNombre: 'ana.perez',
        antes: null,
        despues: null,
        ip: null,
        navegador: null,
        requestId: null,
      }),
    });
    expect(texto()).toContain('por el sistema');
    expect(texto()).toContain('Este evento no cambió datos.');
    expect(dato('Quién')).toBe('El sistema');
    expect(dato('Sobre qué')).toBe('Sesión de ana.perez');
    expect(dato('Desde dónde')).toBeNull();
    expect(html.querySelector('.detalle-evento__enlaces')).toBeNull();
  });

  it('lo de seguridad lleva su marca', async () => {
    const { html } = await montar({
      evento: detalleDePrueba({
        accion: 'auth.usuario.bloquear',
        antes: null,
        despues: { bloqueadoHasta: '2026-11-07T15:06:00.000Z' },
      }),
    });
    expect(html.querySelector('.estado--peligro')?.textContent?.trim()).toBe('Seguridad');
    expect(html.querySelector('.detalle-evento__tabla tbody')?.textContent).toContain(
      '07/11/2026 10:06',
    );
  });

  describe('los permisos de un rol', () => {
    const conPermisos = detalleDePrueba({
      accion: 'auth.rol.permisos',
      entidad: 'rol',
      entidadNombre: 'Contabilidad',
      antes: { permisos: [] },
      despues: { permisos: ['auth.usuario.ver'] },
    });

    it('con «Ver roles», con su descripción', async () => {
      const { texto, consultar, listo } = await montar({ evento: conPermisos });
      await listo();
      expect(consultar.descripcionesPermisos).toHaveBeenCalledTimes(1);
      expect(texto()).toContain('Se agregó: Ver usuarios');
    });

    it('sin «Ver roles», el código, sin pedir el catálogo', async () => {
      const { texto, consultar } = await montar({ evento: conPermisos, permisos: [] });
      expect(consultar.descripcionesPermisos).not.toHaveBeenCalled();
      expect(texto()).toContain('Se agregó: auth.usuario.ver');
    });

    it('si el catálogo no llega, el código', async () => {
      const { texto, listo } = await montar({
        evento: conPermisos,
        descripciones: () => Promise.reject(new Error('sin red')),
      });
      await listo();
      expect(texto()).toContain('Se agregó: auth.usuario.ver');
    });

    it('un evento sin permisos no pide el catálogo', async () => {
      const { consultar } = await montar();
      expect(consultar.descripcionesPermisos).not.toHaveBeenCalled();
    });
  });

  it('un evento que no existe: el mensaje y volver a la bitácora', async () => {
    const { texto, html } = await montar({
      ver: () => Promise.reject(errorHttp(TipoErrorHttp.NO_ENCONTRADO, 'El evento no existe', 404)),
    });
    expect(texto()).toContain('El evento no existe');
    expect(html.querySelector('a[href="/bitacora"]')?.textContent).toContain('Volver a Bitácora');
  });

  it('sin conexión: «Reintentar» lo vuelve a pedir', async () => {
    const { html, consultar, listo, texto } = await montar({
      ver: () => Promise.reject(new Error('sin red')),
    });
    expect(texto()).toContain('No se pudo cargar el evento.');
    consultar.ver.mockResolvedValueOnce(detalleDePrueba());
    [...html.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Reintentar'))
      ?.click();
    await listo();
    expect(consultar.ver).toHaveBeenCalledTimes(2);
    expect(texto()).toContain('Cambió los roles de un usuario');
  });

  it('en el celular, el antes y el después uno debajo del otro', async () => {
    const { html } = await montar({ celular: true });
    expect(html.querySelector('.detalle-evento__tabla')).toBeNull();
    const fila = html.querySelector('.detalle-evento__fila-celular')!;
    expect(fila.querySelector('dt')?.textContent?.trim()).toBe('Roles');
    expect([...fila.querySelectorAll('.detalle-evento__lado')].map((l) => l.textContent)).toEqual([
      'Antes',
      'Después',
    ]);
  });
});
