import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { opcionesHelmet } from './configure-app.js';
import { configurarSwagger } from './swagger.js';

describe('configurarSwagger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('en producción no publica la documentación', () => {
    const crear = vi.spyOn(SwaggerModule, 'createDocument');
    const publicar = vi.spyOn(SwaggerModule, 'setup');
    configurarSwagger({} as INestApplication, 'production');
    expect(crear).not.toHaveBeenCalled();
    expect(publicar).not.toHaveBeenCalled();
  });
});

describe('opcionesHelmet', () => {
  const directivas = (entorno: 'development' | 'production') => {
    const csp = opcionesHelmet(entorno).contentSecurityPolicy;
    return typeof csp === 'object' ? csp.directives : undefined;
  };

  it('en producción pasa todo a https', () => {
    expect(directivas('production')).toEqual({ upgradeInsecureRequests: [] });
  });

  it('en desarrollo no (la API va por http)', () => {
    expect(directivas('development')).toEqual({ upgradeInsecureRequests: null });
  });
});
