import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import type { SesionRemotaPort } from '../../../../application/ports/out/sesion-remota.port';
import type {
  CambioContrasena,
  Credenciales,
  Sesion,
  TokenAcceso,
} from '../../../../domain/sesion';
import { AuthApi, type SesionDto, type SesionIniciadaDto } from './auth.api';

/** Traduce `/auth/…` al dominio. */
@Injectable()
export class SesionRemotaHttpAdapter implements SesionRemotaPort {
  private readonly api = inject(AuthApi);

  async iniciar(credenciales: Credenciales): Promise<TokenAcceso> {
    const respuesta = await firstValueFrom(
      this.api.iniciar(credenciales.nombreUsuario, credenciales.contrasena),
    );
    return aToken(respuesta.data);
  }

  async renovar(): Promise<TokenAcceso | null> {
    try {
      return aToken((await firstValueFrom(this.api.renovar())).data);
    } catch (error) {
      // 401: la sesión terminó (vencida, cerrada o sin cookie). Lo demás, se lanza.
      if (error instanceof ErrorHttp && error.tipo === TipoErrorHttp.NO_AUTENTICADO) return null;
      throw error;
    }
  }

  async consultar(token: TokenAcceso): Promise<Sesion> {
    return aSesion((await firstValueFrom(this.api.sesion(token.valor))).data);
  }

  async cerrar(): Promise<void> {
    await firstValueFrom(this.api.cerrar());
  }

  async cambiarContrasena(cambio: CambioContrasena): Promise<void> {
    await firstValueFrom(this.api.cambiarContrasena(cambio.actual, cambio.nueva));
  }

  async cambiarEmpresa(empresaId: string): Promise<Sesion> {
    return aSesion((await firstValueFrom(this.api.cambiarEmpresa(empresaId))).data);
  }
}

function aToken(dto: SesionIniciadaDto): TokenAcceso {
  return { valor: dto.tokenAcceso, expiraEnSegundos: dto.expiraEnSegundos };
}

function aSesion(dto: SesionDto): Sesion {
  return {
    usuario: { ...dto.usuario },
    empresaActiva: { ...dto.empresaActiva },
    empresas: dto.empresas.map((e) => ({ ...e })),
    esAdministrador: dto.esAdministrador,
    permisos: [...dto.permisos],
    zonaNegocio: dto.zonaNegocio,
    sesionVenceEn: dto.sesionVenceEn,
  };
}
