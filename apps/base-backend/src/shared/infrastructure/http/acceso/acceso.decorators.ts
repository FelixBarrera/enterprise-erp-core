import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  MENSAJE_DEBE_CAMBIAR_CONTRASENA,
  MENSAJE_SESION_TERMINO,
  MENSAJE_SIN_PERMISO,
} from '../../../domain/errors/mensajes-acceso.js';
import { ApiRespuestaError } from '../swagger.decorators.js';

/**
 * Quién puede usar una ruta (AUTH-D9). Cada ruta lleva **exactamente una**: si le falta o le
 * sobra, la API no arranca (lo revisa el módulo `auth` al iniciar, que también revisa que el
 * permiso de `@RequierePermiso()` esté en el catálogo).
 */
export type ReglaAcceso =
  | { readonly tipo: 'publico' }
  | { readonly tipo: 'sesion'; readonly conContrasenaTemporal: boolean }
  | { readonly tipo: 'permiso'; readonly codigo: string };

/** Dónde queda la lista de reglas de cada método (una lista, para ver si sobra alguna). */
const CLAVE_REGLAS_ACCESO = 'acceso:reglas';

export interface OpcionesSoloSesion {
  /**
   * `true` solo en las pocas rutas que se pueden usar con una contraseña temporal (AUTH-D14):
   * ver la sesión, cambiar la contraseña y salir. Por defecto, `false`: esas rutas responden
   * 403 «Debe cambiar su contraseña antes de continuar».
   */
  readonly conContrasenaTemporal?: boolean;
}

/** Sin sesión: login, refresh, `/health`. */
export function Publico(): MethodDecorator {
  return agregarRegla({ tipo: 'publico' });
}

/**
 * Para todo usuario con sesión en la empresa activa, sin permiso especial (su sesión, el nombre
 * de la empresa). Agrega en Swagger el candado y el 401 (y el 403 de AUTH-D14). Si la ruta tiene
 * otro 403, su `@ApiRespuestaError(403, …)` tiene que incluir también el de AUTH-D14 (Swagger
 * guarda uno por estado).
 */
export function SoloSesion(opciones: OpcionesSoloSesion = {}): MethodDecorator {
  const conContrasenaTemporal = opciones.conContrasenaTemporal ?? false;
  const swagger = [ApiBearerAuth(), ApiRespuestaError(401, MENSAJE_SESION_TERMINO)];
  if (!conContrasenaTemporal) {
    swagger.push(ApiRespuestaError(403, MENSAJE_DEBE_CAMBIAR_CONTRASENA));
  }
  return applyDecorators(agregarRegla({ tipo: 'sesion', conContrasenaTemporal }), ...swagger);
}

/**
 * Con sesión y con ese permiso en la empresa activa (el Administrador pasa siempre, AUTH-D10):
 * `@RequierePermiso('auth.usuario.ver')`. El código tiene que estar en el `<modulo>.permisos.ts`
 * de algún módulo; si no, la API no arranca. Nunca con una contraseña temporal (AUTH-D14).
 * Agrega en Swagger el candado, el 401 y el 403 con sus dos mensajes; si la ruta tiene otro 403,
 * su `@ApiRespuestaError(403, …)` tiene que repetir esos dos (Swagger guarda uno por estado).
 */
export function RequierePermiso(codigo: string): MethodDecorator {
  return applyDecorators(
    agregarRegla({ tipo: 'permiso', codigo }),
    ApiBearerAuth(),
    ApiRespuestaError(401, MENSAJE_SESION_TERMINO),
    ApiRespuestaError(403, MENSAJE_SIN_PERMISO, MENSAJE_DEBE_CAMBIAR_CONTRASENA),
  );
}

/** Las reglas que tiene el método de una ruta (vacía si no tiene ninguna). */
export function reglasDeAcceso(metodo: object): readonly ReglaAcceso[] {
  const guardadas: unknown = Reflect.getMetadata(CLAVE_REGLAS_ACCESO, metodo);
  return Array.isArray(guardadas) ? (guardadas as ReglaAcceso[]) : [];
}

function agregarRegla(regla: ReglaAcceso): MethodDecorator {
  return (_objetivo, _nombre, descriptor) => {
    const metodo: unknown = descriptor.value;
    if (typeof metodo !== 'function') {
      return;
    }
    Reflect.defineMetadata(CLAVE_REGLAS_ACCESO, [...reglasDeAcceso(metodo), regla], metodo);
  };
}
