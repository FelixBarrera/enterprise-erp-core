import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import type { Pagina, PedidoPagina } from '../../../../../../shared/domain/pagina';
import { RELOJ, relojFijo } from '../../../../../../shared/infrastructure/fechas/reloj';
import { ZONA_NEGOCIO } from '../../../../../../shared/infrastructure/fechas/zona-negocio';
import { USUARIO_CABECERA } from '../../../../../../shared/infrastructure/layout/usuario-cabecera';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import { PermisosDePrueba } from '../../../../../../shared/infrastructure/permisos/permisos-de-prueba';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { CONSULTAR_BITACORA_PORT } from '../../../../application/ports/in/consultar-bitacora.port';
import { eventoDePrueba } from '../../../../application/testing/eventos-de-prueba';
import type { EventoResumen, UsuarioDeBitacora } from '../../../../domain/evento';
import type { FiltrosBitacora } from '../../../../domain/filtros-bitacora';
import { BitacoraComponent } from './bitacora.component';

const ANA = '0190a4f2-1c2b-7000-8000-000000000101';
const JORGE = '0190a4f2-1c2b-7000-8000-000000000102';

@Component({ template: 'Otra pantalla', changeDetection: ChangeDetectionStrategy.OnPush })
class OtraPantalla {}

const EVENTOS: EventoResumen[] = [
  eventoDePrueba(),
  eventoDePrueba({
    id: 'ev-2',
    ocurridoEn: '2026-11-07T14:51:00.000Z',
    nombreUsuario: 'diana.salazar',
    accion: 'auth.usuario.bloquear',
    entidadNombre: 'diana.salazar',
  }),
  eventoDePrueba({
    id: 'ev-3',
    usuarioId: null,
    nombreUsuario: null,
    accion: 'auth.rol.permisos',
    entidad: 'rol',
    entidadNombre: null,
  }),
];

function pagina(elementos: EventoResumen[]): Pagina<EventoResumen> {
  return { elementos, total: elementos.length, pagina: 1, tamano: 20 };
}

async function montar(
  url = '/bitacora',
  opciones: {
    usuarios?: () => Promise<UsuarioDeBitacora[]>;
    celular?: boolean;
    // 23:30 del 6 en Guayaquil: ya es el 7 en UTC (y en Nueva York, donde corre la prueba, el 6).
    ahora?: string;
    permisos?: string[];
  } = {},
) {
  const listar = vi.fn((_f: FiltrosBitacora, _p: PedidoPagina) => Promise.resolve(pagina(EVENTOS)));
  const usuarios = vi.fn(
    opciones.usuarios ?? (() => Promise.resolve([{ usuarioId: ANA, nombreUsuario: 'ana.perez' }])),
  );
  TestBed.configureTestingModule({
    providers: [
      ...PROVIDERS_MATERIAL,
      provideRouter([
        { path: 'bitacora', component: BitacoraComponent },
        { path: 'bitacora/:id', component: OtraPantalla },
        { path: 'usuarios/:id', component: OtraPantalla },
      ]),
      {
        provide: PERMISOS_SESION,
        useValue: new PermisosDePrueba(opciones.permisos ?? ['auth.usuario.ver']),
      },
      { provide: CONSULTAR_BITACORA_PORT, useValue: { listar, usuarios } },
      { provide: USUARIO_CABECERA, useValue: { nombreEmpresa: signal('Comercial Ejemplo') } },
      { provide: ZONA_NEGOCIO, useValue: signal('America/Guayaquil') },
      { provide: RELOJ, useValue: relojFijo(opciones.ahora ?? '2026-11-07T10:00:00-05:00') },
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
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, BitacoraComponent);
  await harness.fixture.whenStable();
  const html = harness.routeNativeElement!;
  const texto = () => (html.textContent ?? '').replace(/\s+/gu, ' ');
  return { harness, html, texto, listar, router: TestBed.inject(Router) };
}

function cambiarFecha(html: HTMLElement, id: string, valor: string): HTMLInputElement {
  const entrada = html.querySelector<HTMLInputElement>(id)!;
  entrada.value = valor;
  entrada.dispatchEvent(new Event('change'));
  return entrada;
}

describe('BitacoraComponent', () => {
  it('abre con los últimos 7 días de Guayaquil y muestra los eventos', async () => {
    const { listar, texto, html } = await montar();
    expect(listar).toHaveBeenCalledWith(
      { desde: '2026-11-01', hasta: '2026-11-07', usuario: '', accion: '', registro: null },
      { pagina: 1, tamano: 20 },
    );
    expect(texto()).toContain('Lo que se hizo en Comercial Ejemplo, quién lo hizo y cuándo.');
    expect(texto()).toContain('Hasta 92 días por búsqueda. Fechas y horas de Guayaquil.');
    const filas = html.querySelectorAll('tr.bitacora__fila');
    expect(filas).toHaveLength(3);
    expect(filas[0].textContent).toContain('07/11/2026 10:42');
    expect(filas[0].textContent).toContain('ana.perez');
    expect(filas[0].textContent).toContain('Cambió los roles de un usuario');
    expect(filas[0].textContent).toContain('Usuario jorge.vera');
    expect(filas[0].textContent).not.toContain('Seguridad');
    expect(filas[1].textContent).toContain('El usuario quedó bloqueado');
    expect(filas[1].querySelector('.estado--peligro')?.textContent).toBe('Seguridad');
    expect(filas[2].textContent).toContain('El sistema');
    expect(filas[2].textContent).toContain('Un rol');
    expect(html.querySelector<HTMLInputElement>('#bitacora-desde')?.value).toBe('2026-11-01');
  });

  it('«hoy» es el día de Guayaquil, no el del navegador', async () => {
    const { listar } = await montar('/bitacora', { ahora: '2026-11-06T23:30:00-05:00' });
    expect(listar.mock.calls[0][0]).toMatchObject({ desde: '2026-10-31', hasta: '2026-11-06' });
  });

  it('lee los filtros de la URL y dice cuántos hay', async () => {
    const { listar, texto } = await montar(
      `/bitacora?desde=2026-10-01&usuario=${ANA}&accion=auth.usuario`,
    );
    expect(listar).toHaveBeenCalledWith(
      {
        desde: '2026-10-01',
        hasta: '2026-11-07',
        usuario: ANA,
        accion: 'auth.usuario',
        registro: null,
      },
      { pagina: 1, tamano: 20 },
    );
    expect(texto()).toContain('3 activos');
  });

  it('cambiar una fecha busca con ella; un campo vaciado vuelve a la fecha de antes', async () => {
    const { html, router, harness } = await montar();
    cambiarFecha(html, '#bitacora-hasta', '2026-11-05');
    await harness.fixture.whenStable();
    expect(router.url).toBe('/bitacora?hasta=2026-11-05');

    const vaciada = cambiarFecha(html, '#bitacora-desde', '');
    await harness.fixture.whenStable();
    expect(vaciada.value).toBe('2026-11-01');
    expect(router.url).toBe('/bitacora?hasta=2026-11-05');
  });

  it('el mensaje del backend si el rango no vale', async () => {
    const { listar, harness, texto } = await montar();
    listar.mockRejectedValue(
      new ErrorHttp({
        tipo: TipoErrorHttp.VALIDACION,
        mensaje: 'El rango no puede pasar de 92 días',
        estado: 400,
        respondioLaApi: true,
        requestId: null,
        avisado: false,
      }),
    );
    await harness.navigateByUrl('/bitacora?desde=2026-01-01');
    await harness.fixture.whenStable();
    expect(texto()).toContain('El rango no puede pasar de 92 días');
  });

  it('«Limpiar filtros» vuelve a los últimos 7 días', async () => {
    const { html, router, harness } = await montar('/bitacora?accion=auth.rol');
    [...html.querySelectorAll('button')].find((b) => b.textContent?.includes('Limpiar'))?.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/bitacora');
  });

  it('toda la fila abre el detalle; «Qué hizo» es su enlace', async () => {
    const { html, router, harness } = await montar();
    const filas = html.querySelectorAll<HTMLElement>('tr.bitacora__fila');
    expect(filas[1].querySelector('a')?.getAttribute('href')).toBe('/bitacora/ev-2');
    filas[1].querySelector<HTMLElement>('td')?.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/bitacora/ev-2');
  });

  it('«Qué hizo»: todo, cada grupo entero y cada acción, por grupos', async () => {
    const { html, harness } = await montar();
    html.querySelector<HTMLElement>('#bitacora-accion .mat-mdc-select-trigger')?.click();
    await harness.fixture.whenStable();
    const grupos = [...document.querySelectorAll('mat-optgroup')].map((g) =>
      g.querySelector('.mat-mdc-optgroup-label')?.textContent?.trim(),
    );
    expect(grupos).toEqual(['Usuarios', 'Roles', 'Ingresos', 'Empresa']);
    const opciones = [...document.querySelectorAll('mat-option')].map((o) => o.textContent?.trim());
    expect(opciones).toHaveLength(1 + 4 + 26);
    expect(opciones.slice(0, 3)).toEqual(['Todo', 'Todo sobre usuarios', 'Creó un usuario']);
  });

  it('si no llegan los usuarios del filtro, la lista se ve igual', async () => {
    const { texto } = await montar('/bitacora', {
      usuarios: () => Promise.reject(new Error('sin red')),
    });
    expect(texto()).toContain('Cambió los roles de un usuario');
  });

  it('sin eventos: lo dice', async () => {
    const { listar, harness, texto } = await montar();
    listar.mockResolvedValue(pagina([]));
    await harness.navigateByUrl('/bitacora?accion=auth.rol');
    await harness.fixture.whenStable();
    expect(texto()).toContain('Ningún evento coincide con los filtros.');
  });

  it('en el celular: tarjetas, el rango en corto y los filtros detrás de un botón', async () => {
    const { html, texto, harness } = await montar('/bitacora', { celular: true });
    expect(html.querySelectorAll('.lista-tarjetas li')).toHaveLength(3);
    expect(html.querySelector('.lista-tarjetas a.tarjeta-fila')?.getAttribute('href')).toBe(
      `/bitacora/${EVENTOS[0].id}`,
    );
    expect(texto()).toContain('01/11 – 07/11/2026');
    expect(texto()).toContain('07/11/2026 10:42 · ana.perez');
    expect(html.querySelector('#bitacora-filtros')).toBeNull();
    html.querySelector<HTMLButtonElement>('.bitacora__boton-filtros')?.click();
    await harness.fixture.whenStable();
    expect(html.querySelector('#bitacora-filtros #bitacora-desde')).not.toBeNull();
  });

  describe('la historia de un registro («Ver historia»)', () => {
    const HISTORIA = `/bitacora?entidad=usuario&entidadId=${JORGE}`;

    it('pide solo ese registro, sin fechas, y dice de quién es', async () => {
      const { listar, texto, html } = await montar(HISTORIA);
      expect(listar).toHaveBeenCalledWith(
        {
          desde: '',
          hasta: '',
          usuario: '',
          accion: '',
          registro: { entidad: 'usuario', entidadId: JORGE },
        },
        { pagina: 1, tamano: 20 },
      );
      expect(texto()).toContain(
        'Historia del usuario jorge.vera: todo lo que se hizo con él en esta empresa.',
      );
      expect(texto()).toContain('Toda su historia, sin límite de días.');
      expect(texto()).not.toContain('activo');
      const enlaces = [...html.querySelectorAll<HTMLAnchorElement>('.bitacora__historia a')];
      expect(enlaces.map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
        ['Volver a su ficha', `/usuarios/${JORGE}`],
        ['Ver toda la bitácora', '/bitacora'],
      ]);
    });

    it('sin el permiso de ver usuarios, sin «Volver a su ficha»; sin eventos, «de un usuario»', async () => {
      const { listar, harness, texto } = await montar(HISTORIA, { permisos: [] });
      expect(texto()).not.toContain('Volver a su ficha');
      listar.mockResolvedValue(pagina([]));
      await harness.navigateByUrl(`${HISTORIA}&accion=auth.rol`);
      await harness.fixture.whenStable();
      expect(texto()).toContain('Historia de un usuario: todo lo que se hizo');
    });

    it('vaciar una fecha quita el límite; limpiar conserva el registro', async () => {
      const { html, router, harness } = await montar(`${HISTORIA}&desde=2026-10-01`);
      cambiarFecha(html, '#bitacora-desde', '');
      await harness.fixture.whenStable();
      expect(router.url).toBe(HISTORIA);

      await harness.navigateByUrl(`${HISTORIA}&accion=auth.usuario`);
      await harness.fixture.whenStable();
      [...html.querySelectorAll('button')].find((b) => b.textContent?.includes('Limpiar'))?.click();
      await harness.fixture.whenStable();
      expect(router.url).toBe(HISTORIA);
    });

    it('«Ver toda la bitácora» vuelve a los últimos 7 días', async () => {
      const { html, listar, harness, texto, router } = await montar(HISTORIA);
      const enlace = [...html.querySelectorAll<HTMLAnchorElement>('.bitacora__historia a')].at(-1);
      enlace?.click();
      await harness.fixture.whenStable();
      expect(router.url).toBe('/bitacora');
      expect(listar.mock.calls.at(-1)?.[0]).toMatchObject({ desde: '2026-11-01', registro: null });
      expect(texto()).not.toContain('Historia del usuario');
    });
  });
});
