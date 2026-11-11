import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import helmet, { type HelmetOptions } from 'helmet';
import type { Entorno, EnvironmentVariables } from '../config/environment-variables.js';
import { asignarRequestId } from '../contexto/request-id.js';
import { MIDDLEWARE_LOGS } from '../logger/logs.module.js';
import { PREFIJO_API } from './prefijo-api.js';
import { configurarSwagger } from './swagger.js';
import { CaracterNuloPipe } from './caracter-nulo.pipe.js';
import { FiltroErroresFilter } from './filtro-errores.filter.js';
import { crearValidacionPipe } from './validacion.pipe.js';

export { PREFIJO_API };

/**
 * Cabeceras de seguridad. `upgrade-insecure-requests` (pasar todo a https) solo en producción,
 * detrás de Nginx con HTTPS: en desarrollo la API va por http y la página de Swagger no
 * cargaría sus estilos ni sus scripts.
 */
export function opcionesHelmet(entorno: Entorno): HelmetOptions {
  return {
    contentSecurityPolicy: {
      directives: { upgradeInsecureRequests: entorno === 'production' ? [] : null },
    },
  };
}

/**
 * Configuración HTTP de la API. La usan `main.ts` y los e2e (la misma, para probar la real).
 * - Número de petición (`x-request-id`) y la línea del log de cada petición, antes que nada
 *   (antes de leer el cuerpo: así también queda en el log un JSON mal escrito).
 * - helmet: cabeceras de seguridad.
 * - CORS: solo los sitios de `CORS_ORIGINS`, con cookies (el refresh token va en una).
 * - Cookies: se leen (`req.cookies`) para el refresh token; sin firmar (el token ya es secreto).
 * - `TRUST_PROXY`: detrás de Nginx, la IP real del usuario.
 * - Prefijo `api/v1` en todas las rutas.
 * - `Cache-Control: no-store`: el navegador no guarda respuestas (equipos compartidos).
 * - Pipes: primero el carácter nulo, luego la validación. Filtro global de errores.
 * - Swagger en `/api/v1/docs`, solo fuera de producción.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.use(asignarRequestId);
  app.use(app.get<RequestHandler>(MIDDLEWARE_LOGS));
  const entorno = config.get('NODE_ENV', { infer: true });
  app.use(helmet(opcionesHelmet(entorno)));
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.use(cookieParser());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.setGlobalPrefix(PREFIJO_API);
  app.useGlobalPipes(new CaracterNuloPipe(), crearValidacionPipe());
  app.useGlobalFilters(new FiltroErroresFilter());
  configurarSwagger(app, entorno);
}
