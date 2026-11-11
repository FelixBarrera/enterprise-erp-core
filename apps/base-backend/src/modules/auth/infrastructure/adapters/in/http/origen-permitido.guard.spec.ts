import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../../../../../shared/infrastructure/config/environment-variables.js';
import { OrigenNoPermitidoError } from '../../../../domain/errors/auth.errors.js';
import { OrigenPermitidoGuard } from './origen-permitido.guard.js';

const config = {
  get: () => ['http://localhost:4200', 'https://app.ejemplo.test'],
} as unknown as ConfigService<EnvironmentVariables, true>;

function peticion(origin?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: origin === undefined ? {} : { origin } }),
    }),
  } as unknown as ExecutionContext;
}

describe('OrigenPermitidoGuard', () => {
  const guard = new OrigenPermitidoGuard(config);

  it('deja pasar un origen de CORS_ORIGINS', () => {
    expect(guard.canActivate(peticion('https://app.ejemplo.test'))).toBe(true);
  });

  it.each([
    ['sin Origin', undefined],
    ['otro sitio', 'https://malo.test'],
    ['parecido, con / al final', 'http://localhost:4200/'],
    ['otro puerto', 'http://localhost:4300'],
    ['"null" (un iframe aislado)', 'null'],
  ])('rechaza %s', (_caso, origen) => {
    expect(() => guard.canActivate(peticion(origen))).toThrow(OrigenNoPermitidoError);
  });
});
