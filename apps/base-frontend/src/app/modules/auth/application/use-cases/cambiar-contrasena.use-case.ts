import { inject, Injectable } from '@angular/core';
import { type CambioContrasena, conContrasenaCambiada, type Sesion } from '../../domain/sesion';
import type { CambiarContrasenaPort } from '../ports/in/cambiar-contrasena.port';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';

/**
 * Cambia la contraseña (la voluntaria o la temporal, AUTH-D14). La sesión sigue abierta con el
 * mismo token; las de otros equipos las cierra el backend. No se vuelve a pedir la sesión: lo
 * único que cambia es que ya no es temporal (si esa lectura fallara, la persona creería que no
 * se guardó y volvería a escribir la anterior, que ya no sirve).
 */
@Injectable()
export class CambiarContrasenaUseCase implements CambiarContrasenaPort {
  private readonly remota = inject(SESION_REMOTA_PORT);

  async execute(cambio: CambioContrasena, sesion: Sesion): Promise<Sesion> {
    await this.remota.cambiarContrasena(cambio);
    return conContrasenaCambiada(sesion);
  }
}
