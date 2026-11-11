import { ParseUUIDPipe } from '@nestjs/common';
import { SolicitudInvalidaException } from './solicitud-invalida.exception.js';

/**
 * Valida el id de la ruta: `@Param('id', ID_PIPE) id: string`.
 * Un id mal escrito responde 400 "El id no es válido" (sin esto, PostgreSQL falla y sale 500).
 * Acepta cualquier UUID bien formado: un id que no existe es un 404 del caso de uso.
 */
export const ID_PIPE = new ParseUUIDPipe({
  exceptionFactory: () => new SolicitudInvalidaException('El id no es válido'),
});
