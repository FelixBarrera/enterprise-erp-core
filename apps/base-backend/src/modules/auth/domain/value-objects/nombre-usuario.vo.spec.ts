import { NombreUsuarioInvalidoError } from '../errors/auth.errors.js';
import { NombreUsuario } from './nombre-usuario.vo.js';

describe('NombreUsuario', () => {
  it('recorta y pasa a minúsculas', () => {
    expect(NombreUsuario.crear('  Juan.Perez \n').valor).toBe('juan.perez');
  });

  it.each(['abc', 'a.b', 'juan_perez-2', 'x'.repeat(50)])('acepta %j', (texto) => {
    expect(NombreUsuario.crear(texto).valor).toBe(texto);
  });

  it.each(['', '   '])('vacío (%j): obligatorio', (texto) => {
    expect(() => NombreUsuario.crear(texto)).toThrow(
      new NombreUsuarioInvalidoError('El nombre de usuario es obligatorio'),
    );
  });

  it.each(['ab', 'x'.repeat(51), 'juan perez', 'josé', 'muñoz', 'juan@acme', 'a/b'])(
    'rechaza %j',
    (texto) => {
      expect(() => NombreUsuario.crear(texto)).toThrow(/de 3 a 50 caracteres/u);
    },
  );

  it('en el JSON y como texto sale el valor', () => {
    const nombre = NombreUsuario.crear('ana');
    expect(JSON.stringify({ nombre })).toBe('{"nombre":"ana"}');
    expect(String(nombre)).toBe('ana');
  });
});
