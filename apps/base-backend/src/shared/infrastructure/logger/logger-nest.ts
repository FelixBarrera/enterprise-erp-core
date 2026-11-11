import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

/**
 * Los avisos internos de NestJS al arrancar que no se escriben: uno por módulo y uno por ruta
 * (decenas de líneas). Las rutas están en Swagger.
 */
export const CONTEXTOS_SILENCIADOS = new Set([
  'InstanceLoader',
  'RoutesResolver',
  'RouterExplorer',
]);

/** El logger de NestJS (`app.useLogger`), con pino por debajo y sin el ruido del arranque. */
@Injectable()
export class LoggerNest extends Logger {
  override log(mensaje: unknown, ...resto: unknown[]): void {
    const contexto = resto.at(-1);
    if (typeof contexto === 'string' && CONTEXTOS_SILENCIADOS.has(contexto)) {
      return;
    }
    super.log(mensaje, ...resto);
  }
}
