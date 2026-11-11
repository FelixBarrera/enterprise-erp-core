import { applyDecorators, SetMetadata } from '@nestjs/common';
import { MENSAJE_DEMASIADAS_PETICIONES } from '../http/filtro-errores.filter.js';
import { ApiRespuestaError } from '../http/swagger.decorators.js';

const CLAVE_LIMITE_LOGIN = 'limite:login';
const CLAVE_SIN_LIMITE = 'limite:sin-limite';

/**
 * Suma el límite estricto del login (por IP, `LIMITE_LOGIN_POR_MINUTO`) al general. Solo en
 * `POST /auth/login` (AUTH-D17). Pone en Swagger el 429.
 */
export const LimiteLogin = (): MethodDecorator =>
  applyDecorators(
    SetMetadata(CLAVE_LIMITE_LOGIN, true),
    ApiRespuestaError(429, MENSAJE_DEMASIADAS_PETICIONES),
  );

/** Sin ningún límite de peticiones. Solo `/health`: el monitoreo lo llama sin parar. */
export const SinLimite = (): MethodDecorator => SetMetadata(CLAVE_SIN_LIMITE, true);

/** El método de la ruta lleva `@LimiteLogin()`. */
export const tieneLimiteLogin = (metodo: object): boolean =>
  Reflect.getMetadata(CLAVE_LIMITE_LOGIN, metodo) === true;

/** El método de la ruta lleva `@SinLimite()`. */
export const estaSinLimite = (metodo: object): boolean =>
  Reflect.getMetadata(CLAVE_SIN_LIMITE, metodo) === true;
