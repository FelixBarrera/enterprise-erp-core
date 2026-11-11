import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { SolicitudInvalidaException } from './solicitud-invalida.exception.js';

const MENSAJE_VALIDACION_GENERICO = 'Los datos enviados no son válidos';

/**
 * `ValidationPipe` global: solo deja pasar los campos declarados en el DTO
 * ("El campo x no está permitido"), se detiene en el primer error de cada campo
 * y responde 400 con el primer mensaje (en español, el `message` de cada decorador).
 */
export function crearValidacionPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errores) => new SolicitudInvalidaException(primerMensaje(errores)),
  });
}

/** Primer mensaje de la lista, buscando también en los objetos anidados. */
export function primerMensaje(errores: ValidationError[], padre = ''): string {
  for (const error of errores) {
    const campo = padre === '' ? error.property : `${padre}.${error.property}`;
    const restricciones = error.constraints ?? {};
    if (restricciones['whitelistValidation'] !== undefined) {
      return `El campo ${campo} no está permitido`;
    }
    const [mensaje] = Object.values(restricciones);
    if (mensaje !== undefined) {
      return mensaje;
    }
    const anidado = primerMensaje(error.children ?? [], campo);
    if (anidado !== MENSAJE_VALIDACION_GENERICO) {
      return anidado;
    }
  }
  return MENSAJE_VALIDACION_GENERICO;
}
