/**
 * Qué salió mal en una llamada a la API, dicho para la pantalla (no para el técnico).
 * Lo arma el interceptor de errores (`shared/infrastructure/http/errores.interceptor.ts`);
 * ninguna pantalla ve un `HttpErrorResponse`.
 */
export const TipoErrorHttp = {
  /** No se llegó al servidor (sin internet, servidor apagado). Aviso global. */
  SIN_CONEXION: 'SIN_CONEXION',
  /** 502, 503, 504, o un 5xx que no mandó la API. Aviso global. */
  SERVIDOR_NO_DISPONIBLE: 'SERVIDOR_NO_DISPONIBLE',
  /** Otro 5xx de la API. Aviso global. */
  ERROR_SERVIDOR: 'ERROR_SERVIDOR',
  /** 401: lo resuelve el interceptor de auth (paso 6). */
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  /** 403. Aviso global con el mensaje del backend. */
  NO_AUTORIZADO: 'NO_AUTORIZADO',
  /** 400. Lo muestra la pantalla. */
  VALIDACION: 'VALIDACION',
  /** 404. Lo muestra la pantalla. */
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  /** 409. Lo muestra la pantalla. */
  CONFLICTO: 'CONFLICTO',
  /** 422. Lo muestra la pantalla. */
  REGLA_NEGOCIO: 'REGLA_NEGOCIO',
  /** 429. Lo muestra la pantalla. */
  DEMASIADAS_PETICIONES: 'DEMASIADAS_PETICIONES',
  /** Cualquier otro 4xx. Lo muestra la pantalla. */
  SOLICITUD_RECHAZADA: 'SOLICITUD_RECHAZADA',
} as const;
export type TipoErrorHttp = (typeof TipoErrorHttp)[keyof typeof TipoErrorHttp];

export interface DatosErrorHttp {
  tipo: TipoErrorHttp;
  /** En español, listo para mostrar. */
  mensaje: string;
  /** Estado HTTP; `0` si no hubo respuesta. */
  estado: number;
  /** `true` si el cuerpo tiene la forma `{ success, data, message }` (lo mandó la API, no un proxy). */
  respondioLaApi: boolean;
  /** Valor de `x-request-id` de la respuesta, para buscar en los logs; `null` si no vino. */
  requestId: string | null;
  /** `true` si el interceptor ya mostró el aviso global: la pantalla no lo repite. */
  avisado: boolean;
}

export class ErrorHttp extends Error {
  readonly tipo: TipoErrorHttp;
  readonly estado: number;
  readonly respondioLaApi: boolean;
  readonly requestId: string | null;
  readonly avisado: boolean;

  constructor(datos: DatosErrorHttp) {
    super(datos.mensaje);
    this.name = 'ErrorHttp';
    this.tipo = datos.tipo;
    this.estado = datos.estado;
    this.respondioLaApi = datos.respondioLaApi;
    this.requestId = datos.requestId;
    this.avisado = datos.avisado;
  }
}

/** Los que avisa el interceptor en un modal global (docs/arquitectura-frontend.md, regla 9). */
export function esAvisoGlobal(tipo: TipoErrorHttp): boolean {
  return (
    tipo === TipoErrorHttp.SIN_CONEXION ||
    tipo === TipoErrorHttp.SERVIDOR_NO_DISPONIBLE ||
    tipo === TipoErrorHttp.ERROR_SERVIDOR ||
    tipo === TipoErrorHttp.NO_AUTORIZADO
  );
}
