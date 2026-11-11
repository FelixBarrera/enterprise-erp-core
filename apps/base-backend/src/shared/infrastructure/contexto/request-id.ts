import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type {} from 'pino-http'; // agrega `id` al tipo de la petición

export const CABECERA_REQUEST_ID = 'x-request-id';

// Lo que llega de afuera (Nginx, el frontend) se acepta solo si es corto y sin caracteres raros:
// así nadie mete saltos de línea o texto falso en el log.
const FORMATO_VALIDO = /^[A-Za-z0-9-]{8,64}$/;

/** El número de la petición: el que llegó en `x-request-id` si es válido; si no, uno nuevo. */
export function elegirRequestId(recibido: string | string[] | undefined): string {
  return typeof recibido === 'string' && FORMATO_VALIDO.test(recibido) ? recibido : randomUUID();
}

/**
 * Middleware (el primero de todos, en `configureApp()`): pone el número de la petición en
 * `req.id` y en la cabecera de la respuesta. El log y el contexto de la petición lo leen de ahí.
 */
export function asignarRequestId(req: Request, res: Response, next: NextFunction): void {
  const id = elegirRequestId(req.headers[CABECERA_REQUEST_ID]);
  req.id = id;
  // Para medir cuánto tardó (la línea del log de los errores 5xx).
  res.locals['inicio'] = Date.now();
  res.setHeader(CABECERA_REQUEST_ID, id);
  next();
}
