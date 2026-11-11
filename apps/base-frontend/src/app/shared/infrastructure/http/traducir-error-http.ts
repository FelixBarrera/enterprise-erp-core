import { type HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ErrorHttp, esAvisoGlobal, TipoErrorHttp } from '../../domain/errors/error-http';

const MENSAJE_SIN_CONEXION =
  'No hay conexión con el servidor. Revise su internet e intente de nuevo.';
const MENSAJE_NO_DISPONIBLE = 'El servidor no está disponible. Intente de nuevo en unos minutos.';
const MENSAJE_ERROR_SERVIDOR =
  'Ocurrió un error en el servidor. Intente de nuevo; si se repite, avise a soporte.';

/** Si la API no mandó mensaje (o la respuesta no es suya), estos. */
const MENSAJES_POR_TIPO: Record<TipoErrorHttp, string> = {
  SIN_CONEXION: MENSAJE_SIN_CONEXION,
  SERVIDOR_NO_DISPONIBLE: MENSAJE_NO_DISPONIBLE,
  ERROR_SERVIDOR: MENSAJE_ERROR_SERVIDOR,
  NO_AUTENTICADO: 'Su sesión terminó. Vuelva a ingresar.',
  NO_AUTORIZADO: 'No tiene permiso para esta acción.',
  VALIDACION: 'Revise los datos ingresados.',
  NO_ENCONTRADO: 'No se encontró lo que busca.',
  CONFLICTO: 'No se pudo guardar porque los datos cambiaron o ya existen.',
  REGLA_NEGOCIO: 'La operación no está permitida.',
  DEMASIADAS_PETICIONES: 'Demasiadas peticiones; espere un momento e intente de nuevo.',
  SOLICITUD_RECHAZADA: 'La solicitud no se pudo procesar.',
};

const TIPO_POR_ESTADO: Partial<Record<number, TipoErrorHttp>> = {
  [HttpStatusCode.BadRequest]: TipoErrorHttp.VALIDACION,
  [HttpStatusCode.Unauthorized]: TipoErrorHttp.NO_AUTENTICADO,
  [HttpStatusCode.Forbidden]: TipoErrorHttp.NO_AUTORIZADO,
  [HttpStatusCode.NotFound]: TipoErrorHttp.NO_ENCONTRADO,
  [HttpStatusCode.Conflict]: TipoErrorHttp.CONFLICTO,
  [HttpStatusCode.UnprocessableEntity]: TipoErrorHttp.REGLA_NEGOCIO,
  [HttpStatusCode.TooManyRequests]: TipoErrorHttp.DEMASIADAS_PETICIONES,
};

const NO_DISPONIBLE = new Set<number>([
  HttpStatusCode.BadGateway,
  HttpStatusCode.ServiceUnavailable,
  HttpStatusCode.GatewayTimeout,
]);

/**
 * Convierte la respuesta de Angular en un `ErrorHttp`. Queda `avisado` si es de los que van en
 * aviso global y la petición lo permite. En los 5xx nunca se muestra el texto del servidor.
 */
export function traducirErrorHttp(
  error: HttpErrorResponse,
  permiteAvisoGlobal: boolean,
): ErrorHttp {
  const cuerpo: unknown = error.error;
  const respondioLaApi = esRespuestaDeLaApi(cuerpo);
  const mensajeApi = respondioLaApi ? mensajeDeLaApi(cuerpo) : null;
  const tipo = tipoDe(error.status, respondioLaApi);
  const esDelServidor = error.status >= 500 || error.status === 0;
  return new ErrorHttp({
    tipo,
    mensaje: esDelServidor || mensajeApi === null ? MENSAJES_POR_TIPO[tipo] : mensajeApi,
    estado: error.status,
    respondioLaApi,
    requestId: error.headers.get('x-request-id'),
    avisado: permiteAvisoGlobal && esAvisoGlobal(tipo),
  });
}

function tipoDe(estado: number, respondioLaApi: boolean): TipoErrorHttp {
  if (estado === 0) return TipoErrorHttp.SIN_CONEXION;
  if (estado >= 500) {
    // Un 500 que no mandó la API es del proxy de desarrollo con la API apagada, o de Nginx.
    return NO_DISPONIBLE.has(estado) || !respondioLaApi
      ? TipoErrorHttp.SERVIDOR_NO_DISPONIBLE
      : TipoErrorHttp.ERROR_SERVIDOR;
  }
  return TIPO_POR_ESTADO[estado] ?? TipoErrorHttp.SOLICITUD_RECHAZADA;
}

/** La API responde los errores con `{ success: false, data, message }`; un proxy o Nginx, no. */
function esRespuestaDeLaApi(cuerpo: unknown): cuerpo is { success: false } {
  return (
    typeof cuerpo === 'object' && cuerpo !== null && 'success' in cuerpo && cuerpo.success === false
  );
}

/** El `message` de la API, si trae texto; si no, `null`. */
function mensajeDeLaApi(cuerpo: { success: false }): string | null {
  if (!('message' in cuerpo) || typeof cuerpo.message !== 'string') return null;
  const mensaje = cuerpo.message.trim();
  return mensaje === '' ? null : mensaje;
}
