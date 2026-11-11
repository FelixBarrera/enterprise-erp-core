import { CodigoPermisoInvalidoError } from '../errors/auth.errors.js';
import { CodigoPermiso } from './codigo-permiso.vo.js';

describe('CodigoPermiso', () => {
  it.each(['auth.usuario.ver', 'auth.usuario.asignar_roles', 'ventas2.factura.anular'])(
    'acepta %s y dice su módulo',
    (texto) => {
      const codigo = CodigoPermiso.crear(texto);
      expect(codigo.valor).toBe(texto);
      expect(codigo.modulo).toBe(texto.split('.')[0]);
      expect(JSON.stringify({ codigo })).toBe(`{"codigo":"${texto}"}`);
      expect(String(codigo)).toBe(texto);
    },
  );

  it.each([
    '',
    'auth.usuario',
    'auth.usuario.ver.extra',
    'Auth.usuario.ver',
    ' auth.usuario.ver',
    'auth.usuario.ver ',
    'auth..ver',
    'auth.usuario-x.ver',
    'auth.usuário.ver',
    `auth.usuario.${'a'.repeat(90)}`,
  ])('rechaza «%s» sin corregirlo', (texto) => {
    expect(() => CodigoPermiso.crear(texto)).toThrow(CodigoPermisoInvalidoError);
  });

  it('el mensaje dice cuál y no crece con un texto enorme', () => {
    expect(() => CodigoPermiso.crear('mal')).toThrow(
      'El permiso «mal» no tiene el formato modulo.recurso.accion',
    );
    try {
      CodigoPermiso.crear('x'.repeat(5000));
    } catch (error) {
      expect((error as Error).message.length).toBeLessThan(200);
    }
  });
});
