import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Actor } from '../../../application/actor.js';

/** Lo que deja el guard del módulo `auth` en cada petición con sesión. */
export interface SesionDePeticion {
  /** Quién opera, en su empresa activa (lo reciben los casos de uso que escriben). */
  readonly actor: Actor & { readonly usuarioId: string; readonly empresaId: string };
  /** La sesión (el `sid` del access token). */
  readonly sesionId: string;
  /** Tiene el rol Administrador de la empresa activa (AUTH-D10). */
  readonly esAdministrador: boolean;
}

/** Una por petición: se va con ella (WeakMap), sin tocar el tipo `Request` de Express. */
const SESIONES = new WeakMap<Request, SesionDePeticion>();

/** Lo llama solo el guard, después de revisar la sesión. */
export function guardarSesionDePeticion(peticion: Request, sesion: SesionDePeticion): void {
  SESIONES.set(peticion, sesion);
}

/**
 * La sesión de la petición. Si no hay, la ruta es `@Publico()` y no debería pedirla: es un
 * error de programación (500), no del usuario.
 */
export function sesionDePeticion(peticion: Request): SesionDePeticion {
  const sesion = SESIONES.get(peticion);
  if (sesion === undefined) {
    throw new Error('La ruta pide la sesión pero no tiene @SoloSesion() (o no pasó por el guard)');
  }
  return sesion;
}

/**
 * La sesión de la petición, o `null` si la ruta es `@Publico()`. Para lo que corre después del
 * guard de sesión y sirve con o sin ella (el límite de peticiones).
 */
export function sesionDePeticionSiHay(peticion: Request): SesionDePeticion | null {
  return SESIONES.get(peticion) ?? null;
}

const desdeContexto = (contexto: ExecutionContext): SesionDePeticion =>
  sesionDePeticion(contexto.switchToHttp().getRequest<Request>());

/** El `Actor` de la petición: `@UsuarioActual() actor: Actor` (último parámetro del caso de uso). */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): Actor => desdeContexto(contexto).actor,
);

/** Todo lo de la sesión (para las rutas de `/auth`, que necesitan el `sid`). */
export const SesionActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): SesionDePeticion => desdeContexto(contexto),
);
