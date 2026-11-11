import { guardarMenuEstrecho, leerMenuEstrecho } from './menu-estrecho';

describe('menú estrecho recordado', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('sin nada guardado, ancho', () => {
    expect(leerMenuEstrecho()).toBe(false);
  });

  it('guarda y lee lo elegido', () => {
    guardarMenuEstrecho(true);
    expect(leerMenuEstrecho()).toBe(true);
    guardarMenuEstrecho(false);
    expect(leerMenuEstrecho()).toBe(false);
    expect(localStorage.getItem('menu.estrecho')).toBeNull();
  });

  it('si el navegador no deja guardar ni leer, sigue sin fallar', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => guardarMenuEstrecho(true)).not.toThrow();
    expect(leerMenuEstrecho()).toBe(false);
  });
});
