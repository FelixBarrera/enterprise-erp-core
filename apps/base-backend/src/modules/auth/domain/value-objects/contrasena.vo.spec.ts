import { ContrasenaDebilError } from '../errors/auth.errors.js';
import { Contrasena, type ContextoContrasena, normalizarContrasena } from './contrasena.vo.js';

const COMUNES = new Set(['password', 'iloveyou']);
const contexto: ContextoContrasena = {
  nombreUsuario: 'juan.perez',
  nombresEmpresas: ['Comercial del Sur', 'Acme'],
  esComun: (texto) => COMUNES.has(texto),
};
const crear = (texto: string) => Contrasena.crear(texto, contexto);

describe('Contrasena', () => {
  it('acepta una frase sin reglas de composición', () => {
    expect(crear('caballo bateria grapa').valor).toBe('caballo bateria grapa');
  });

  it('no recorta: el espacio es parte de la contraseña', () => {
    expect(crear('  tren azul 7  ').valor).toBe('  tren azul 7  ');
  });

  it('normaliza a NFKC: la misma contraseña de dos teclados da lo mismo', () => {
    expect(crear('ｔｒｅｎ azul 7').valor).toBe('tren azul 7');
    expect(normalizarContrasena('Pérez')).toBe('Pérez');
  });

  it('8 caracteres sirve, 7 no; 128 sirve, 129 no (cuenta caracteres, no bytes)', () => {
    expect(crear('río7mar!').valor).toHaveLength(8);
    expect(() => crear('rio7ma!')).toThrow(
      new ContrasenaDebilError('La contraseña debe tener al menos 8 caracteres'),
    );
    const larga = 'tren azul 7 '.repeat(11).slice(0, 128);
    expect(crear(larga).valor).toHaveLength(128);
    expect(() => crear(`${larga}x`)).toThrow('La contraseña no puede pasar de 128 caracteres');
    expect(crear('🙂🙂 casa 7 sol').valor).toBe('🙂🙂 casa 7 sol');
  });

  it.each(['password', 'PassWord', 'ILOVEYOU'])(
    'rechaza la común %j (sin importar mayúsculas)',
    (texto) => {
      expect(() => crear(texto)).toThrow('La contraseña es demasiado común');
    },
  );

  it.each([
    'aaaaaaaa',
    'abababab',
    'abcabcabc',
    'abcdabcd',
    '12345678',
    '87654321',
    'abcdefgh',
    'HGFEDCBA',
    'qwertyui',
    'asdfghjk',
    'lkjhgfds',
    'poiuytre',
  ])('rechaza la trivial %j', (texto) => {
    expect(() => crear(texto)).toThrow(/demasiado fácil de adivinar/u);
  });

  it('un trozo de cinco que se repite ya no es trivial', () => {
    expect(crear('abcdeabcde').valor).toBe('abcdeabcde');
  });

  it.each(['Juan.Perez2026', 'xxJUANPEREZxx', 'juan-perez!!'])(
    'rechaza %j: contiene el nombre de usuario (sin puntos, guiones ni mayúsculas)',
    (texto) => {
      expect(() => crear(texto)).toThrow('La contraseña no puede contener su nombre de usuario');
    },
  );

  it.each(['ComercialDelSur1', 'comercial 2026!', 'Comérciál99!'])(
    'rechaza %j: contiene el nombre de la empresa o una de sus palabras largas',
    (texto) => {
      expect(() => crear(texto)).toThrow('La contraseña no puede contener el nombre de la empresa');
    },
  );

  it('las palabras cortas ("del", "sur") solo cuentan dentro del nombre entero', () => {
    expect(crear('del sur, el mejor').valor).toBe('del sur, el mejor');
  });

  it('una empresa de nombre corto ("Acme") no cuenta: rechazaría demasiado', () => {
    expect(crear('acme tren azul').valor).toBe('acme tren azul');
  });

  it('un usuario de nombre corto (menos de 3 letras sin símbolos) no cuenta', () => {
    const corto = { ...contexto, nombreUsuario: 'a.b' };
    expect(Contrasena.crear('tren a b azul', corto).valor).toBe('tren a b azul');
  });

  it('nunca se muestra: en el JSON y como texto sale [OCULTO]', () => {
    const contrasena = crear('caballo bateria grapa');
    expect(JSON.stringify({ contrasena })).toBe('{"contrasena":"[OCULTO]"}');
    expect(String(contrasena)).toBe('[OCULTO]');
  });
});
