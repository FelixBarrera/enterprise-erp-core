import { type ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  normalizeIp,
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { sesionDePeticionSiHay } from '../http/acceso/sesion-de-peticion.js';
import { estaSinLimite, tieneLimiteLogin } from './limite.decorators.js';
import { ALMACEN_LIMITE, OPCIONES_LIMITE, type OpcionesLimite } from './opciones-limite.js';

/** La ventana de todos los límites: un minuto. */
export const VENTANA_LIMITE_MS = 60_000;

/** Los tres límites (AUTH-D17), con el nombre que llevan en las claves de Redis. */
export type NombreLimite = 'login' | 'usuario' | 'ip';

const peticionDe = (contexto: ExecutionContext): Request =>
  contexto.switchToHttp().getRequest<Request>();

const tieneSesion = (contexto: ExecutionContext): boolean =>
  sesionDePeticionSiHay(peticionDe(contexto)) !== null;

/** La IP (detrás de un proxy, la del cliente si `TRUST_PROXY=true`); IPv6 por su red /64. */
const ipDe = (contexto: ExecutionContext): string => {
  const ip = peticionDe(contexto).ip;
  return ip === undefined || ip === '' ? 'sin-ip' : normalizeIp(ip);
};

const usuarioDe = (contexto: ExecutionContext): string =>
  sesionDePeticionSiHay(peticionDe(contexto))?.actor.usuarioId ?? 'sin-usuario';

/** Arma las opciones de `@nestjs/throttler`: quién cuenta para cada límite y cuándo no aplica. */
export function opcionesThrottler(opciones: OpcionesLimite): ThrottlerModuleOptions {
  const limite = (
    nombre: NombreLimite,
    porMinuto: number,
    porQuien: typeof ipDe,
    noAplica: (c: ExecutionContext) => boolean,
  ) => ({
    name: nombre,
    limit: porMinuto,
    ttl: VENTANA_LIMITE_MS,
    skipIf: noAplica,
    getTracker: (_peticion: unknown, contexto: ExecutionContext) => porQuien(contexto),
  });
  return {
    // Las cabeceras X-RateLimit-* no se mandan; al pasarse, solo Retry-After.
    setHeaders: false,
    throttlers: [
      limite('login', opciones.loginPorMinuto, ipDe, (c) => !tieneLimiteLogin(c.getHandler())),
      limite('usuario', opciones.usuarioPorMinuto, usuarioDe, (c) => !tieneSesion(c)),
      limite('ip', opciones.ipPorMinuto, ipDe, tieneSesion),
    ],
  };
}

/**
 * Límite de peticiones (AUTH-D17). Corre **después** de `SesionGuard` (los dos se registran en
 * ese orden en `AuthModule`): con sesión cuenta por usuario; sin sesión, por IP; el login suma
 * además su límite por IP. `@SinLimite()` (solo `/health`) no cuenta. Al pasarse: 429 con
 * `Retry-After` (segundos). Si Redis no responde, deja pasar (lo decide `AlmacenLimiteRedis`).
 */
@Injectable()
export class LimitePeticionesGuard extends ThrottlerGuard {
  private readonly log = new Logger(LimitePeticionesGuard.name);

  constructor(
    @Inject(OPCIONES_LIMITE) opciones: OpcionesLimite,
    @Inject(ALMACEN_LIMITE) almacen: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(opcionesThrottler(opciones), almacen, reflector);
  }

  protected override shouldSkip(contexto: ExecutionContext): Promise<boolean> {
    return Promise.resolve(contexto.getType() !== 'http' || estaSinLimite(contexto.getHandler()));
  }

  /** Un contador por límite y por quién, para toda la API (no uno por ruta). */
  protected override generateKey(
    _contexto: ExecutionContext,
    quien: string,
    nombre: string,
  ): string {
    return `${nombre}:${quien}`;
  }

  protected override throwThrottlingException(
    contexto: ExecutionContext,
    detalle: ThrottlerLimitDetail,
  ): Promise<void> {
    contexto
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', String(Math.max(detalle.timeToBlockExpire, 1)));
    this.log.warn(`Límite de peticiones superado (${detalle.key}): ${detalle.limit} por minuto`);
    // El filtro global pone el mensaje en español (429).
    throw new ThrottlerException();
  }
}
