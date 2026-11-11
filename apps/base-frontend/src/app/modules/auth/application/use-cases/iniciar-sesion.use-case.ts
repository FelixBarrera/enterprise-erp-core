import { inject, Injectable } from '@angular/core';
import type { Credenciales, ResultadoIngreso } from '../../domain/sesion';
import type { IniciarSesionPort } from '../ports/in/iniciar-sesion.port';
import { SESION_REMOTA_PORT } from '../ports/out/sesion-remota.port';

/** Entra y trae los datos de la sesión con el token recién dado. */
@Injectable()
export class IniciarSesionUseCase implements IniciarSesionPort {
  private readonly remota = inject(SESION_REMOTA_PORT);

  async execute(credenciales: Credenciales): Promise<ResultadoIngreso> {
    const token = await this.remota.iniciar(credenciales);
    const sesion = await this.remota.consultar(token);
    return { tipo: 'sesion-iniciada', sesion: { token, sesion } };
  }
}
