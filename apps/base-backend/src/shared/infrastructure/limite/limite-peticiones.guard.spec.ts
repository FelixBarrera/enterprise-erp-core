import { type ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, type ThrottlerStorage } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { actorDelSistema } from '../../application/actor.js';
import { Publico, SoloSesion } from '../http/acceso/acceso.decorators.js';
import { guardarSesionDePeticion } from '../http/acceso/sesion-de-peticion.js';
import { LimiteLogin, SinLimite } from './limite.decorators.js';
import { LimitePeticionesGuard } from './limite-peticiones.guard.js';

class Rutas {
  @Publico()
  @LimiteLogin()
  login(this: void): void {}

  @Publico()
  refresh(this: void): void {}

  @Publico()
  @SinLimite()
  health(this: void): void {}

  @SoloSesion()
  datos(this: void): void {}
}

/** Cuenta en memoria, como Redis pero sin bloqueo que caduque (basta para estas pruebas). */
class AlmacenEnMemoria implements ThrottlerStorage {
  readonly claves: string[] = [];
  private readonly cuentas = new Map<string, number>();

  increment(clave: string, _ttl: number, limite: number, bloqueoMs: number) {
    this.claves.push(clave);
    const total = (this.cuentas.get(clave) ?? 0) + 1;
    this.cuentas.set(clave, total);
    const bloqueado = total > limite;
    return Promise.resolve({
      totalHits: total,
      timeToExpire: 60,
      isBlocked: bloqueado,
      timeToBlockExpire: bloqueado ? bloqueoMs / 1000 : 0,
    });
  }
}

interface Peticion {
  readonly peticion: Request;
  readonly cabeceras: Map<string, string>;
}

function nuevaPeticion(ip: string | undefined, usuarioId?: string): Peticion {
  const peticion = { ip, headers: {} } as Request;
  if (usuarioId !== undefined) {
    guardarSesionDePeticion(peticion, {
      sesionId: 'sid',
      esAdministrador: false,
      actor: { ...actorDelSistema({ empresaId: 'e' }), usuarioId, empresaId: 'e' },
    });
  }
  return { peticion, cabeceras: new Map() };
}

function contexto(metodo: (this: void) => void, { peticion, cabeceras }: Peticion, tipo = 'http') {
  const respuesta = {
    setHeader: (nombre: string, valor: string) => cabeceras.set(nombre, valor),
  } as unknown as Response;
  return {
    getType: () => tipo,
    getHandler: () => metodo,
    getClass: () => Rutas,
    switchToHttp: () => ({ getRequest: () => peticion, getResponse: () => respuesta }),
  } as unknown as ExecutionContext;
}

describe('LimitePeticionesGuard', () => {
  let almacen: AlmacenEnMemoria;
  let guard: LimitePeticionesGuard;
  let aviso: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    aviso = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    almacen = new AlmacenEnMemoria();
    guard = new LimitePeticionesGuard(
      { loginPorMinuto: 2, usuarioPorMinuto: 3, ipPorMinuto: 4 },
      almacen,
      new Reflector(),
    );
    await guard.onModuleInit();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin sesión cuenta por IP, para toda la API (no por ruta)', async () => {
    await guard.canActivate(contexto(Rutas.prototype.refresh, nuevaPeticion('10.0.0.5')));
    await guard.canActivate(contexto(Rutas.prototype.refresh, nuevaPeticion('10.0.0.5')));

    expect(almacen.claves).toEqual(['ip:10.0.0.5', 'ip:10.0.0.5']);
  });

  it('con sesión cuenta por usuario, no por IP', async () => {
    await guard.canActivate(contexto(Rutas.prototype.datos, nuevaPeticion('10.0.0.5', 'u-1')));
    await guard.canActivate(contexto(Rutas.prototype.datos, nuevaPeticion('10.0.0.9', 'u-1')));

    expect(almacen.claves).toEqual(['usuario:u-1', 'usuario:u-1']);
  });

  it('el login suma su propio límite por IP al de sin sesión', async () => {
    await guard.canActivate(contexto(Rutas.prototype.login, nuevaPeticion('10.0.0.5')));

    expect(almacen.claves).toEqual(['login:10.0.0.5', 'ip:10.0.0.5']);
  });

  it('IPv6 cuenta por su red (/64); sin IP, todas juntas', async () => {
    await guard.canActivate(contexto(Rutas.prototype.refresh, nuevaPeticion('2001:db8:1:2::abcd')));
    await guard.canActivate(contexto(Rutas.prototype.refresh, nuevaPeticion(undefined)));

    expect(almacen.claves).toEqual(['ip:2001:db8:1:2::/64', 'ip:sin-ip']);
  });

  it('@SinLimite() y lo que no es HTTP no cuentan', async () => {
    await expect(
      guard.canActivate(contexto(Rutas.prototype.health, nuevaPeticion('10.0.0.5'))),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contexto(Rutas.prototype.refresh, nuevaPeticion('10.0.0.5'), 'rpc')),
    ).resolves.toBe(true);

    expect(almacen.claves).toEqual([]);
  });

  it('al pasarse: 429 con Retry-After en segundos y un aviso en el log', async () => {
    for (let i = 0; i < 2; i++) {
      await guard.canActivate(contexto(Rutas.prototype.login, nuevaPeticion('10.0.0.5')));
    }
    const tercera = nuevaPeticion('10.0.0.5');

    await expect(guard.canActivate(contexto(Rutas.prototype.login, tercera))).rejects.toThrow(
      ThrottlerException,
    );
    expect(tercera.cabeceras.get('Retry-After')).toBe('60');
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('login:10.0.0.5'));
  });

  it('cada usuario tiene su cupo', async () => {
    for (let i = 0; i < 3; i++) {
      await guard.canActivate(contexto(Rutas.prototype.datos, nuevaPeticion('10.0.0.5', 'u-1')));
    }

    await expect(
      guard.canActivate(contexto(Rutas.prototype.datos, nuevaPeticion('10.0.0.5', 'u-1'))),
    ).rejects.toThrow(ThrottlerException);
    await expect(
      guard.canActivate(contexto(Rutas.prototype.datos, nuevaPeticion('10.0.0.5', 'u-2'))),
    ).resolves.toBe(true);
  });
});
