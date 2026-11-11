import { DatosLocalesCacheAdapter } from './datos-locales.cache.adapter';

describe('DatosLocalesCacheAdapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('borra solo las cachés de datos del service worker (no el código)', async () => {
    const borradas: string[] = [];
    vi.stubGlobal('caches', {
      keys: () => Promise.resolve(['ngsw:/:1:data:dynamic:x:cache', 'ngsw:/:1:assets:app:cache']),
      delete: (nombre: string) => {
        borradas.push(nombre);
        return Promise.resolve(true);
      },
    });
    await new DatosLocalesCacheAdapter().borrar();
    expect(borradas).toEqual(['ngsw:/:1:data:dynamic:x:cache']);
  });

  it('sin cachés en el navegador, no hace nada', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(new DatosLocalesCacheAdapter().borrar()).resolves.toBeUndefined();
  });

  it('si el navegador no deja leerlas, sigue sin lanzar', async () => {
    vi.stubGlobal('caches', { keys: () => Promise.reject(new Error('sin permiso')) });
    await expect(new DatosLocalesCacheAdapter().borrar()).resolves.toBeUndefined();
  });
});
