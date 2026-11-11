import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Respuesta de éxito en Swagger, con la forma `{ success: true, data, message }`.
 * - `@ApiRespuestaOk(ClienteRespuestaDto, 'Cliente registrado', 201)` en un POST que crea.
 * - `@ApiRespuestaOk([ClienteRespuestaDto], 'Clientes')` para una lista.
 * El DTO es una clase con `@ApiProperty` en español en cada campo.
 */
export function ApiRespuestaOk(
  dto: Type | [Type],
  mensaje: string,
  estado: 200 | 201 | 202 = 200,
): MethodDecorator & ClassDecorator {
  const esLista = Array.isArray(dto);
  const modelo = esLista ? dto[0] : dto;
  const referencia = { $ref: getSchemaPath(modelo) };
  return applyDecorators(
    ApiExtraModels(modelo),
    ApiResponse({
      status: estado,
      description: mensaje,
      schema: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: esLista ? { type: 'array', items: referencia } : referencia,
          message: { type: 'string', example: mensaje },
        },
      },
    }),
  );
}

/**
 * Respuesta de éxito de un listado paginado: `data` es una `Pagina` con los elementos de ese DTO.
 * `@ApiRespuestaPagina(UsuarioResumenDto, 'Usuarios')`.
 */
export function ApiRespuestaPagina(dto: Type, mensaje: string): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiResponse({
      status: 200,
      description: mensaje,
      schema: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            required: ['elementos', 'total', 'pagina', 'tamano'],
            properties: {
              elementos: { type: 'array', items: { $ref: getSchemaPath(dto) } },
              total: {
                type: 'integer',
                description: 'Cuántos hay en total con esos filtros',
                example: 42,
              },
              pagina: { type: 'integer', description: 'Página devuelta, desde 1', example: 1 },
              tamano: { type: 'integer', description: 'Elementos por página', example: 20 },
            },
          },
          message: { type: 'string', example: mensaje },
        },
      },
    }),
  );
}

/**
 * Respuesta de éxito sin datos (`data: null`), por ejemplo al salir:
 * `@ApiRespuestaOkSinDatos('Sesión cerrada')`.
 */
export function ApiRespuestaOkSinDatos(
  mensaje: string,
  estado: 200 | 201 | 202 = 200,
): MethodDecorator & ClassDecorator {
  return ApiResponse({
    status: estado,
    description: mensaje,
    schema: {
      type: 'object',
      required: ['success', 'data', 'message'],
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'null', example: null },
        message: { type: 'string', example: mensaje },
      },
    },
  });
}

/**
 * Un error posible del endpoint, con la forma `{ success: false, data: null, message }`.
 * Uno por cada estado; si un estado tiene varios mensajes, van todos en el mismo decorador:
 * `@ApiRespuestaError(400, 'El nombre es obligatorio', 'El correo no es válido')`
 * (dos decoradores con el mismo estado se pisan: Swagger guarda uno por estado).
 */
export function ApiRespuestaError(
  estado: number,
  mensaje: string,
  ...otrosMensajes: string[]
): MethodDecorator & ClassDecorator {
  const mensajes = [mensaje, ...otrosMensajes];
  return ApiResponse({
    status: estado,
    description: mensajes.join(' · '),
    schema: {
      type: 'object',
      required: ['success', 'data', 'message'],
      properties: {
        success: { type: 'boolean', example: false },
        data: { type: 'null', example: null },
        message: {
          type: 'string',
          example: mensaje,
          ...(mensajes.length > 1 ? { enum: mensajes } : {}),
        },
      },
    },
  });
}
