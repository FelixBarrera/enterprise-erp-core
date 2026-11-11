import type { Request, Response } from 'express';
import type { DestinationStream, LevelWithSilent } from 'pino';
import type { Options } from 'pino-http';
import pretty from 'pino-pretty';
import { partesEnZonaNegocio } from '../../domain/zona-negocio.js';
import type { Entorno, NivelLog } from '../config/environment-variables.js';
import { PREFIJO_API } from '../http/prefijo-api.js';

export const OCULTO = '[OCULTO]';

/** Lo que nunca se escribe en el log (docs/arquitectura-backend.md, sección 10). */
const CAMPOS_SENSIBLES = [
  'password',
  'contrasena',
  'contrasenaActual',
  'contrasenaNueva',
  'token',
  'accessToken',
  'refreshToken',
  'secreto',
  'secret',
];
const RUTAS_OCULTAS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  // Hasta dos niveles de profundidad en lo que el código mande al log.
  ...CAMPOS_SENSIBLES.flatMap((campo) => [campo, `*.${campo}`, `*.*.${campo}`]),
];

const RUTA_HEALTH = `/${PREFIJO_API}/health`;
const METODOS_DE_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/** La dirección completa de la petición (con la query), como la vio Express. */
function ruta(req: Request): string {
  return req.originalUrl || req.url;
}

/** `GET /api/v1/usuarios?pagina=2 → 401 (4 ms) [req 057e7236]` */
export function lineaDePeticion(req: Request, res: Response, milisegundos: number): string {
  const id = typeof req.id === 'string' ? req.id.slice(0, 8) : '?';
  return `${req.method} ${ruta(req)} → ${res.statusCode} (${Math.round(milisegundos)} ms) [req ${id}]`;
}

/**
 * Nivel de la línea de cada petición: 5xx error, 4xx warn y el resto info.
 * En desarrollo, las lecturas que salieron bien no se escriben (tapan las escrituras y los
 * errores); en producción sí.
 */
export function nivelDePeticion(entorno: Entorno, req: Request, res: Response): LevelWithSilent {
  if (res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  if (entorno === 'development' && METODOS_DE_LECTURA.has(req.method)) return 'silent';
  return 'info';
}

/** `/health` no se registra: el monitoreo lo llama cada pocos segundos. */
export function ignorarPeticion(req: Request): boolean {
  const camino = ruta(req).split('?')[0] ?? '';
  return camino === RUTA_HEALTH || camino.startsWith(`${RUTA_HEALTH}/`);
}

/** La hora del log en desarrollo: `10:59:44`, en la zona del negocio (nunca la del servidor). */
export function horaDelLog(milisegundos: number): string {
  const { hora, minuto, segundo } = partesEnZonaNegocio(new Date(milisegundos));
  return [hora, minuto, segundo].map((valor) => String(valor).padStart(2, '0')).join(':');
}

/**
 * Formato legible de desarrollo:
 * `[10:59:44] WARN: GET /api/v1/x → 404 (2 ms) [req 057e7236]` y, debajo, el mensaje que vio el
 * usuario. Corre dentro del proceso (no en un hilo aparte) para poder usar funciones propias.
 */
export function formatoDesarrollo(salida?: DestinationStream): DestinationStream {
  return pretty({
    // Por defecto, la consola; las pruebas pasan otra salida.
    ...(salida ? { destination: salida } : {}),
    colorize: true,
    // La hora se pone a mano (en la zona del negocio): pino-pretty usaría la del servidor.
    translateTime: false,
    customPrettifiers: { time: (valor) => `[${horaDelLog(Number(valor))}]` },
    ignore: 'pid,hostname,req,res,responseTime,requestId,context,mensajeUsuario',
    messageFormat: (log, claveMensaje) => {
      const contexto = typeof log['context'] === 'string' ? `(${log['context']}) ` : '';
      const mensajeUsuario = log['mensajeUsuario'];
      const debajo = typeof mensajeUsuario === 'string' ? `\n    ${mensajeUsuario}` : '';
      return `${contexto}${String(log[claveMensaje])}${debajo}`;
    },
  });
}

function inicioDe(res: Response): number {
  const inicio: unknown = res.locals?.['inicio'];
  return typeof inicio === 'number' ? inicio : Date.now();
}

/** Agrega a la línea de la petición el mensaje que vio el usuario (si hubo error). */
function conMensajeUsuario(res: Response, valor: Record<string, unknown>): Record<string, unknown> {
  const mensajeUsuario: unknown = res.locals?.['mensajeUsuario'];
  return typeof mensajeUsuario === 'string' ? { ...valor, mensajeUsuario } : valor;
}

export interface ConfiguracionLogs {
  entorno: Entorno;
  nivel: NivelLog;
  /** Solo pruebas: adónde escribir (por defecto, la consola). */
  destino?: DestinationStream;
}

/**
 * Opciones de pino-http: una línea por petición (sin cabeceras ni cuerpo), con su número de
 * petición; lo sensible sale como `[OCULTO]`. Legible en desarrollo, JSON en producción.
 */
export type OpcionesLogs =
  Options<Request, Response> | [Options<Request, Response>, DestinationStream];

export function crearOpcionesLogs(configuracion: ConfiguracionLogs): OpcionesLogs {
  const { entorno, nivel, destino } = configuracion;
  const opciones: Options<Request, Response> = {
    level: nivel,
    redact: { paths: RUTAS_OCULTAS, censor: OCULTO },
    // El número ya lo puso `asignarRequestId` (configureApp).
    genReqId: (req) => req.id,
    // Dentro de una petición, cada log lleva solo el número de la petición (no la petición entera).
    quietReqLogger: true,
    quietResLogger: true,
    customAttributeKeys: { reqId: 'requestId' },
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    autoLogging: { ignore: ignorarPeticion },
    customLogLevel: (req, res) => nivelDePeticion(entorno, req, res),
    customSuccessMessage: (req, res, milisegundos) => lineaDePeticion(req, res, milisegundos),
    // pino-http no da el tiempo a este mensaje: se calcula con la hora de inicio que guardó
    // `asignarRequestId`.
    customErrorMessage: (req, res) => lineaDePeticion(req, res, Date.now() - inicioDe(res)),
    customSuccessObject: (_req, res, valor: Record<string, unknown>) =>
      conMensajeUsuario(res, valor),
    customErrorObject: (_req, res, _error, valor: Record<string, unknown>) =>
      conMensajeUsuario(res, valor),
  };
  if (destino) return [opciones, destino];
  return entorno === 'development' ? [opciones, formatoDesarrollo()] : opciones;
}
