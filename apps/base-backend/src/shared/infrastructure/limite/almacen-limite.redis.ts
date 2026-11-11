import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { RELOJ_PORT, type RelojPort } from '../../application/ports/reloj.port.js';
import { CONEXION_REDIS } from '../redis/conexion-redis.js';

/**
 * Cuenta y bloquea en un solo paso dentro de Redis (atómico: dos peticiones a la vez no se
 * pisan). Ventana fija: el contador vive `ttl` ms desde la primera petición. Al pasarse del
 * límite se bloquea `bloqueo` ms; mientras dura el bloqueo no se sigue contando.
 * Devuelve `{ peticiones, msVentana, bloqueado (0/1), msBloqueo }`.
 */
const CONTAR_Y_BLOQUEAR = `
local msBloqueo = redis.call('PTTL', KEYS[2])
if msBloqueo > 0 then
  local peticiones = tonumber(redis.call('GET', KEYS[1]) or '0')
  return { peticiones, math.max(redis.call('PTTL', KEYS[1]), 0), 1, msBloqueo }
end
local peticiones = redis.call('INCR', KEYS[1])
local msVentana = redis.call('PTTL', KEYS[1])
if msVentana < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  msVentana = tonumber(ARGV[1])
end
if peticiones > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { peticiones, msVentana, 1, tonumber(ARGV[3]) }
end
return { peticiones, msVentana, 0, 0 }
`;

/** Prefijo de las claves del límite (después del de la base: `base_erp:limite:…`). */
export const PREFIJO_CLAVES_LIMITE = 'limite:';

/** Cada cuánto, como mucho, se repite en el log que Redis falló (para no llenarlo). */
const MS_ENTRE_AVISOS = 60_000;

/** Lo que devuelve `increment()` (la librería no exporta su nombre). */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/** Si Redis no responde, la petición pasa (AUTH-D17): el bloqueo por usuario sigue en la base. */
const SIN_LIMITE: ThrottlerStorageRecord = {
  totalHits: 0,
  timeToExpire: 0,
  isBlocked: false,
  timeToBlockExpire: 0,
};

const aSegundos = (ms: number): number => Math.ceil(ms / 1000);

/** El almacenamiento de `@nestjs/throttler` sobre Redis (AUTH-D17). */
@Injectable()
export class AlmacenLimiteRedis implements ThrottlerStorage {
  private readonly logger = new Logger(AlmacenLimiteRedis.name);
  private ultimoAviso: number | null = null;

  constructor(
    @Inject(CONEXION_REDIS) private readonly redis: Redis,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
  ) {}

  async increment(
    clave: string,
    ttlMs: number,
    limite: number,
    bloqueoMs: number,
  ): Promise<ThrottlerStorageRecord> {
    const contador = `${PREFIJO_CLAVES_LIMITE}${clave}`;
    try {
      const respuesta = await this.redis.eval(
        CONTAR_Y_BLOQUEAR,
        2,
        contador,
        `${contador}:bloqueo`,
        ttlMs,
        limite,
        bloqueoMs,
      );
      const [peticiones, msVentana, bloqueado, msBloqueo] = leerRespuesta(respuesta);
      return {
        totalHits: peticiones,
        timeToExpire: aSegundos(msVentana),
        isBlocked: bloqueado === 1,
        timeToBlockExpire: aSegundos(msBloqueo),
      };
    } catch (error) {
      this.avisarFallo(error);
      return SIN_LIMITE;
    }
  }

  private avisarFallo(error: unknown): void {
    const ahora = this.reloj.ahora().getTime();
    if (this.ultimoAviso !== null && ahora - this.ultimoAviso < MS_ENTRE_AVISOS) {
      return;
    }
    this.ultimoAviso = ahora;
    const motivo = error instanceof Error ? error.message : String(error);
    this.logger.error(`Límite de peticiones sin Redis (las peticiones pasan): ${motivo}`);
  }
}

function leerRespuesta(respuesta: unknown): [number, number, number, number] {
  if (
    !Array.isArray(respuesta) ||
    respuesta.length !== 4 ||
    !respuesta.every((n): n is number => typeof n === 'number')
  ) {
    throw new Error('Redis devolvió una respuesta inesperada al contar');
  }
  const [peticiones, msVentana, bloqueado, msBloqueo] = respuesta;
  return [peticiones, msVentana, bloqueado, msBloqueo];
}
