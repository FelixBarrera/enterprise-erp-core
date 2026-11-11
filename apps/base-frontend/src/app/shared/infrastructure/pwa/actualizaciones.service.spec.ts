import { DOCUMENT } from '@angular/common';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, type UnrecoverableStateEvent, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { ConfirmacionService } from '../avisos/confirmacion.service';
import { NotificacionesService } from '../avisos/notificaciones.service';
import { MARCA } from '../layout/marca/marca';
import {
  ActualizacionesService,
  INTERVALO_BUSCAR_VERSION_MS,
  RECARGAR_PAGINA,
} from './actualizaciones.service';

const VERSION = { hash: 'a', appData: {} };
const VERSION_LISTA: VersionEvent = {
  type: 'VERSION_READY',
  currentVersion: VERSION,
  latestVersion: { hash: 'b', appData: {} },
};
const VERSION_DETECTADA: VersionEvent = { type: 'VERSION_DETECTED', version: VERSION };

function preparar(opciones: { activo?: boolean; confirma?: boolean } = {}) {
  const versionUpdates = new Subject<VersionEvent>();
  const unrecoverable = new Subject<UnrecoverableStateEvent>();
  const sw = {
    isEnabled: opciones.activo ?? true,
    versionUpdates,
    unrecoverable,
    checkForUpdate: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
  };
  let responder: (valor: boolean) => void = () => undefined;
  const confirmar = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        responder = resolve;
        if (opciones.confirma !== undefined) resolve(opciones.confirma);
      }),
  );
  const error = vi.fn<(texto: string) => Promise<void>>().mockResolvedValue(undefined);
  const recargar = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: SwUpdate, useValue: sw },
      { provide: ConfirmacionService, useValue: { confirmar } },
      { provide: NotificacionesService, useValue: { error } },
      { provide: RECARGAR_PAGINA, useValue: recargar },
    ],
  });
  const servicio = TestBed.inject(ActualizacionesService);
  return {
    servicio,
    sw,
    versionUpdates,
    unrecoverable,
    confirmar,
    error,
    recargar,
    responder: (valor: boolean) => responder(valor),
  };
}

describe('ActualizacionesService', () => {
  afterEach(() => vi.useRealTimers());

  it('sin service worker (desarrollo, pruebas) no hace nada', async () => {
    const { servicio, versionUpdates, confirmar } = preparar({ activo: false });
    servicio.iniciar();

    versionUpdates.next(VERSION_LISTA);
    await Promise.resolve();

    expect(confirmar).not.toHaveBeenCalled();
  });

  it('con una versión nueva lista pregunta y, si acepta, recarga', async () => {
    const { servicio, versionUpdates, confirmar, recargar } = preparar({ confirma: true });
    servicio.iniciar();

    versionUpdates.next(VERSION_LISTA);

    await vi.waitFor(() => expect(recargar).toHaveBeenCalledTimes(1));
    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: `Hay una versión nueva de ${MARCA.nombre}`,
        textoConfirmar: 'Actualizar',
      }),
    );
  });

  it('si no acepta, no recarga (la versión nueva entra la próxima vez)', async () => {
    const { servicio, versionUpdates, confirmar, recargar } = preparar({ confirma: false });
    servicio.iniciar();

    versionUpdates.next(VERSION_LISTA);

    await vi.waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(recargar).not.toHaveBeenCalled();
  });

  it('solo pregunta por la versión lista, no por las que se están descargando', async () => {
    const { servicio, versionUpdates, confirmar } = preparar({ confirma: false });
    servicio.iniciar();

    versionUpdates.next(VERSION_DETECTADA);
    await Promise.resolve();

    expect(confirmar).not.toHaveBeenCalled();
  });

  it('no abre dos preguntas a la vez; después de responder, puede volver a preguntar', async () => {
    const { servicio, versionUpdates, confirmar, responder } = preparar();
    servicio.iniciar();

    versionUpdates.next(VERSION_LISTA);
    versionUpdates.next(VERSION_LISTA);
    expect(confirmar).toHaveBeenCalledTimes(1);

    responder(false);
    await vi.waitFor(async () => {
      versionUpdates.next(VERSION_LISTA);
      expect(confirmar).toHaveBeenCalledTimes(2);
    });
  });

  it('si el service worker no puede seguir, avisa y recarga', async () => {
    const { servicio, unrecoverable, error, recargar } = preparar();
    servicio.iniciar();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'falta un archivo' });

    await vi.waitFor(() => expect(recargar).toHaveBeenCalledTimes(1));
    expect(error).toHaveBeenCalledWith(
      'La aplicación necesita recargarse para seguir funcionando.',
    );
  });

  it('con la pestaña abierta busca versión cada hora; sin conexión, sigue intentando', async () => {
    vi.useFakeTimers();
    const { servicio, sw } = preparar();
    sw.checkForUpdate.mockRejectedValueOnce(new Error('sin conexión'));
    servicio.iniciar();
    await TestBed.inject(ApplicationRef).whenStable();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(INTERVALO_BUSCAR_VERSION_MS);
    await vi.advanceTimersByTimeAsync(INTERVALO_BUSCAR_VERSION_MS);

    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('al destruirse deja de escuchar y de buscar', async () => {
    vi.useFakeTimers();
    const { servicio, sw, versionUpdates, confirmar } = preparar();
    servicio.iniciar();
    await TestBed.inject(ApplicationRef).whenStable();
    await vi.advanceTimersByTimeAsync(0);

    TestBed.resetTestingModule();
    versionUpdates.next(VERSION_LISTA);
    await vi.advanceTimersByTimeAsync(INTERVALO_BUSCAR_VERSION_MS);

    expect(confirmar).not.toHaveBeenCalled();
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
  });
});

describe('RECARGAR_PAGINA', () => {
  it('recarga la página del documento', () => {
    const reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { location: { reload } } }],
    });

    TestBed.inject(RECARGAR_PAGINA)();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
