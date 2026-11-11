import { inject, Injectable } from '@angular/core';
import type { SesionAbierta } from '../../domain/sesion';
import type { RenovarSesionPort } from '../ports/in/renovar-sesion.port';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';

/**
 * Pide un token nuevo con la cookie y vuelve a leer la sesión: así los permisos se renuevan con
 * cada refresh (docs/arquitectura-frontend.md, sección 6).
 */
@Injectable()
export class RenovarSesionUseCase implements RenovarSesionPort {
  private readonly remota = inject(SESION_REMOTA_PORT);

  async execute(): Promise<SesionAbierta | null> {
    const token = await this.remota.renovar();
    if (token === null) return null;
    return { token, sesion: await this.remota.consultar(token) };
  }
}
