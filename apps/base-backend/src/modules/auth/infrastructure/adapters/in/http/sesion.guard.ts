import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { reglasDeAcceso } from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import { guardarSesionDePeticion } from '../../../../../../shared/infrastructure/http/acceso/sesion-de-peticion.js';
import {
  AUTENTICAR_PETICION_PORT,
  type AutenticarPeticionPort,
} from '../../../../application/ports/in/autenticar-peticion.port.js';

/**
 * Guard global (AUTH-D9): toda ruta exige sesión salvo `@Publico()`. Con `@SoloSesion()` revisa
 * el access token y la sesión (`AUTENTICAR_PETICION_PORT`); con `@RequierePermiso()`, además, el
 * permiso (en la misma consulta). Deja el `Actor` para `@UsuarioActual()`. Una ruta sin regla (o con más de una) no debería existir: la API no
 * arranca así (`RevisorReglasAcceso`); si igual llega una, se rechaza (500), nunca se deja pasar.
 */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    @Inject(AUTENTICAR_PETICION_PORT) private readonly autenticar: AutenticarPeticionPort,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const reglas = reglasDeAcceso(contexto.getHandler());
    const [regla] = reglas;
    if (regla === undefined || reglas.length > 1) {
      throw new Error(
        `La ruta ${contexto.getClass().name}.${contexto.getHandler().name} no tiene exactamente ` +
          'una regla de acceso (@Publico, @SoloSesion, @RequierePermiso)',
      );
    }
    if (regla.tipo === 'publico') {
      return true;
    }
    const peticion = contexto.switchToHttp().getRequest<Request>();
    const autenticada = await this.autenticar.execute({
      tokenAcceso: leerTokenBearer(peticion),
      permiteContrasenaTemporal: regla.tipo === 'sesion' && regla.conContrasenaTemporal,
      permisoRequerido: regla.tipo === 'permiso' ? regla.codigo : null,
    });
    guardarSesionDePeticion(peticion, autenticada);
    return true;
  }
}

/** El token de `Authorization: Bearer <token>` (el esquema sin importar mayúsculas); si no, `null`. */
export function leerTokenBearer(peticion: Request): string | null {
  const cabecera = peticion.headers.authorization;
  if (cabecera === undefined) {
    return null;
  }
  const partes = /^Bearer +(\S+) *$/i.exec(cabecera);
  return partes?.[1] ?? null;
}
