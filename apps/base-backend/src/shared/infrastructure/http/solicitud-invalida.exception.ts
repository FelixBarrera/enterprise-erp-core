import { BadRequestException } from '@nestjs/common';

/**
 * 400 con un mensaje propio en español. La lanzan los pipes (validación, id, carácter nulo).
 * El filtro global muestra su mensaje tal cual; las demás excepciones de NestJS traen
 * textos en inglés y se reemplazan por uno genérico en español.
 */
export class SolicitudInvalidaException extends BadRequestException {}
