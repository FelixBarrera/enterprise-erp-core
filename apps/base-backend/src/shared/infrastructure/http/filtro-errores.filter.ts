import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, TipoErrorDominio } from '../../domain/errors/domain-error.js';
import { respuestaError } from './respuesta-api.js';
import { SolicitudInvalidaException } from './solicitud-invalida.exception.js';

const ESTADO_POR_TIPO: Record<TipoErrorDominio, number> = {
  [TipoErrorDominio.VALIDACION]: HttpStatus.BAD_REQUEST,
  [TipoErrorDominio.NO_AUTENTICADO]: HttpStatus.UNAUTHORIZED,
  [TipoErrorDominio.NO_AUTORIZADO]: HttpStatus.FORBIDDEN,
  [TipoErrorDominio.NO_ENCONTRADO]: HttpStatus.NOT_FOUND,
  [TipoErrorDominio.CONFLICTO]: HttpStatus.CONFLICT,
  [TipoErrorDominio.REGLA_NEGOCIO]: HttpStatus.UNPROCESSABLE_ENTITY,
};

/** El 429 del límite de peticiones (AUTH-D17). */
export const MENSAJE_DEMASIADAS_PETICIONES =
  'Demasiadas peticiones; espere un momento e intente de nuevo';

/**
 * Textos en español para los errores de NestJS y Express, que vienen en inglés.
 * NestJS ya convierte los errores 4xx de Express (cuerpo muy grande, JSON mal escrito)
 * en `HttpException`, así que basta con su estado.
 */
const MENSAJE_POR_ESTADO: Partial<Record<number, string>> = {
  // NestJS lo usa para un JSON mal escrito o una dirección con % mal codificado.
  [HttpStatus.BAD_REQUEST]: 'La solicitud está mal formada',
  [HttpStatus.UNAUTHORIZED]: 'No ha iniciado sesión',
  [HttpStatus.FORBIDDEN]: 'No tiene permiso para esta acción',
  [HttpStatus.NOT_FOUND]: 'La ruta solicitada no existe',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Método no permitido',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'El contenido enviado es demasiado grande',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'El tipo de contenido enviado no es compatible',
  [HttpStatus.TOO_MANY_REQUESTS]: MENSAJE_DEMASIADAS_PETICIONES,
};

const MENSAJE_GENERICO_4XX = 'La solicitud no se pudo procesar';
export const MENSAJE_ERROR_INTERNO = 'Error interno del servidor';
const MENSAJE_NO_DISPONIBLE = 'El servicio no está disponible en este momento';

interface Traduccion {
  estado: number;
  mensaje: string;
}

/**
 * Filtro global: convierte cualquier error en `{ success: false, data: null, message }`.
 * - `DomainError` → su estado según el tipo y su mensaje.
 * - `SolicitudInvalidaException` (los pipes) → 400 con su mensaje.
 * - Otros errores de NestJS y Express (ruta inexistente, JSON mal escrito, cuerpo muy grande)
 *   → su estado con un mensaje en español (nunca el texto en inglés).
 * - Cualquier otro → 500 "Error interno del servidor" y el detalle solo al log.
 */
@Catch()
export class FiltroErroresFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost): void {
    const { estado, mensaje } = this.traducir(error);
    if (estado >= 500) {
      const detalle = error instanceof Error ? (error.stack ?? error.message) : String(error);
      this.logger.error(detalle);
    }
    const respuesta = host.switchToHttp().getResponse<Response>();
    // La línea del log de la petición lo muestra debajo (lo que vio el usuario).
    respuesta.locals['mensajeUsuario'] = mensaje;
    respuesta.status(estado).json(respuestaError(mensaje));
  }

  private traducir(error: unknown): Traduccion {
    if (error instanceof DomainError) {
      return { estado: ESTADO_POR_TIPO[error.tipo], mensaje: error.message };
    }
    if (error instanceof SolicitudInvalidaException) {
      return { estado: HttpStatus.BAD_REQUEST, mensaje: error.message };
    }
    if (error instanceof HttpException) {
      return this.porEstado(error.getStatus());
    }
    return {
      estado: HttpStatus.INTERNAL_SERVER_ERROR,
      mensaje: MENSAJE_ERROR_INTERNO,
    };
  }

  private porEstado(estado: number): Traduccion {
    if (estado === HttpStatus.SERVICE_UNAVAILABLE) {
      return { estado, mensaje: MENSAJE_NO_DISPONIBLE };
    }
    if (estado >= 500) {
      return { estado, mensaje: MENSAJE_ERROR_INTERNO };
    }
    return {
      estado,
      mensaje: MENSAJE_POR_ESTADO[estado] ?? MENSAJE_GENERICO_4XX,
    };
  }
}
