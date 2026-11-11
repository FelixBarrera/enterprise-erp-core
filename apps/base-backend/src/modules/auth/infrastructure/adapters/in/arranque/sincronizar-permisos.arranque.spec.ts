import { Logger } from '@nestjs/common';
import type {
  ResumenSincronizacion,
  SincronizarPermisosPort,
} from '../../../../application/ports/in/sincronizar-permisos.port.js';
import { SincronizarPermisosAlArrancar } from './sincronizar-permisos.arranque.js';

describe('SincronizarPermisosAlArrancar', () => {
  const conResumen = (resumen: ResumenSincronizacion): SincronizarPermisosPort => ({
    execute: () => Promise.resolve(resumen),
  });
  let log: ReturnType<typeof vi.spyOn>;
  let aviso: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    aviso = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin cambios lo dice en una línea', async () => {
    await new SincronizarPermisosAlArrancar(
      conResumen({ creados: [], actualizados: [], obsoletos: [] }),
    ).onApplicationBootstrap();
    expect(log).toHaveBeenCalledWith('Catálogo de permisos al día');
    expect(aviso).not.toHaveBeenCalled();
  });

  it('con cambios los cuenta, y avisa cuáles quedaron obsoletos', async () => {
    await new SincronizarPermisosAlArrancar(
      conResumen({ creados: ['a.b.c'], actualizados: [], obsoletos: ['a.b.d', 'a.b.e'] }),
    ).onApplicationBootstrap();
    expect(log).toHaveBeenCalledWith('Catálogo de permisos: 1 nuevos, 0 actualizados, 2 obsoletos');
    expect(aviso).toHaveBeenCalledWith('Permisos que el código ya no declara: a.b.d, a.b.e');
  });

  it('si falla, el error sube y la API no arranca', async () => {
    const roto: SincronizarPermisosPort = { execute: () => Promise.reject(new Error('sin base')) };
    await expect(new SincronizarPermisosAlArrancar(roto).onApplicationBootstrap()).rejects.toThrow(
      'sin base',
    );
  });
});
