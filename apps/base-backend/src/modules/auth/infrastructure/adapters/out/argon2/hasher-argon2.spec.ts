import { Contrasena } from '../../../../domain/value-objects/contrasena.vo.js';
import { HasherArgon2 } from './hasher-argon2.js';

const contexto = { nombreUsuario: 'ana', nombresEmpresas: [], esComun: () => false };

describe('HasherArgon2', () => {
  const hasher = new HasherArgon2();

  it('Argon2id con los parámetros de la arquitectura (19 MiB, 2 pasadas, 1 hilo), en PHC', async () => {
    const hash = await hasher.calcularHash(Contrasena.crear('tren azul 7', contexto));
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/u);
    expect(hash).not.toContain('tren');
  });

  it('cada hash lleva su sal: la misma contraseña da dos hashes distintos', async () => {
    const contrasena = Contrasena.crear('tren azul 7', contexto);
    expect(await hasher.calcularHash(contrasena)).not.toBe(await hasher.calcularHash(contrasena));
  });

  it('verifica la correcta, rechaza otra y normaliza lo escrito igual (NFKC)', async () => {
    const hash = await hasher.calcularHash(Contrasena.crear('tren azul 7', contexto));
    expect(await hasher.verificar(hash, 'tren azul 7')).toBe(true);
    expect(await hasher.verificar(hash, 'ｔｒｅｎ azul 7')).toBe(true);
    expect(await hasher.verificar(hash, 'tren azul 8')).toBe(false);
    expect(await hasher.verificar(hash, ' tren azul 7')).toBe(false);
  });

  it('un hash dañado da false, no un error', async () => {
    expect(await hasher.verificar('no-es-un-hash', 'tren azul 7')).toBe(false);
    expect(await hasher.verificar('', 'tren azul 7')).toBe(false);
  });

  it('el relleno siempre da false, tarda como una verificación real y calcula su hash una sola vez', async () => {
    const espia = vi.spyOn(hasher, 'verificar');
    expect(await hasher.verificarRelleno('tren azul 7')).toBe(false);
    expect(await hasher.verificarRelleno('')).toBe(false);
    // Las dos veces verificó contra el mismo hash Argon2id (no contra uno vacío).
    const [[primero], [segundo]] = espia.mock.calls as [[string, string], [string, string]];
    expect(primero).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/u);
    expect(segundo).toBe(primero);
    espia.mockRestore();
  });
});
