import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MARCA } from '../../../marca.js';
import type { Entorno } from '../config/environment-variables.js';
import { PREFIJO_API } from './prefijo-api.js';

export const RUTA_DOCS = `${PREFIJO_API}/docs`;
export const RUTA_DOCS_JSON = `${PREFIJO_API}/docs-json`;

const TITULO_DOCS = `${MARCA.nombre}: API`;

/**
 * Documentación de la API (Swagger), en `/api/v1/docs` y en JSON en `/api/v1/docs-json`.
 * **Solo fuera de producción**: en producción no se publica el mapa de la API.
 * La llama `configureApp()`, así los e2e prueban la misma.
 */
export function configurarSwagger(app: INestApplication, entorno: Entorno): void {
  if (entorno === 'production') {
    return;
  }
  const configuracion = new DocumentBuilder()
    .setTitle(TITULO_DOCS)
    .setDescription(
      [
        MARCA.descripcion,
        '',
        'Toda respuesta tiene la forma `{ success, data, message }`. En un error, `data` es `null`',
        'y `message` explica qué pasó, en español. Cada respuesta trae su número de petición en la',
        'cabecera `x-request-id` (sirve para buscarla en el log).',
        '',
        'Fechas del negocio como `aaaa-mm-dd` y montos como texto (`"1234.50"`). Las fechas',
        'salen en la zona horaria del negocio (`ZONA_NEGOCIO`, por defecto America/Guayaquil).',
      ].join('\n'),
    )
    .setVersion('1')
    // Para cuando exista el login: el botón "Authorize" pide el token de acceso.
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const documento = SwaggerModule.createDocument(app, configuracion);
  SwaggerModule.setup(RUTA_DOCS, app, documento, {
    jsonDocumentUrl: RUTA_DOCS_JSON,
    // Sin el YAML: con el JSON basta.
    yamlDocumentUrl: undefined,
    customSiteTitle: TITULO_DOCS,
    swaggerOptions: {
      // Recuerda el token entre recargas de la página (solo en el navegador de quien prueba).
      persistAuthorization: true,
      // Ordenado como en el código, con el buscador de rutas.
      filter: true,
      docExpansion: 'list',
    },
  });
}
