import type { ClsService } from 'nestjs-cls';
import { ContextoPeticionCls, type DatosPeticion } from './contexto-peticion.cls.js';

function clsFalso(activo: boolean, datos: Partial<DatosPeticion>, id?: string) {
  return {
    isActive: () => activo,
    getId: () => id,
    get: (clave: keyof DatosPeticion) => datos[clave],
  } as unknown as ClsService<DatosPeticion>;
}

describe('ContextoPeticionCls', () => {
  it('dentro de una petición da su número, la IP y el navegador', () => {
    const contexto = new ContextoPeticionCls(
      clsFalso(true, { ip: '10.0.0.5', navegador: 'Firefox' }, 'abc12345'),
    );
    expect(contexto.requestId()).toBe('abc12345');
    expect(contexto.ip()).toBe('10.0.0.5');
    expect(contexto.navegador()).toBe('Firefox');
  });

  it('dentro de una petición sin esos datos da null', () => {
    const contexto = new ContextoPeticionCls(clsFalso(true, {}));
    expect(contexto.requestId()).toBeNull();
    expect(contexto.ip()).toBeNull();
    expect(contexto.navegador()).toBeNull();
  });

  it('fuera de una petición (una cola, un comando) todo es null', () => {
    const contexto = new ContextoPeticionCls(clsFalso(false, { ip: '10.0.0.5' }, 'abc12345'));
    expect(contexto.requestId()).toBeNull();
    expect(contexto.ip()).toBeNull();
    expect(contexto.navegador()).toBeNull();
  });
});
