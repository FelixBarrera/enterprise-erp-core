import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { EnvironmentVariables } from '../../../../../../shared/infrastructure/config/environment-variables.js';
import { OrigenNoPermitidoError } from '../../../../domain/errors/auth.errors.js';

/**
 * Protección contra CSRF en las rutas que usan la cookie de la sesión (refresh y logout):
 * además de `SameSite=Strict`, la cabecera `Origin` tiene que ser uno de `CORS_ORIGINS`. Sin
 * `Origin` también se rechaza: los navegadores siempre la mandan en un POST.
 */
@Injectable()
export class OrigenPermitidoGuard implements CanActivate {
  private readonly permitidos: ReadonlySet<string>;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.permitidos = new Set(config.get('CORS_ORIGINS', { infer: true }));
  }

  canActivate(contexto: ExecutionContext): boolean {
    const origen = contexto.switchToHttp().getRequest<Request>().headers.origin;
    if (origen === undefined || !this.permitidos.has(origen)) {
      throw new OrigenNoPermitidoError();
    }
    return true;
  }
}
