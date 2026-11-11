import { guardarSeccionesCerradas, leerSeccionesCerradas } from './secciones-cerradas';

const CLAVE = 'menu.secciones-cerradas';

describe('secciones cerradas del menú', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('sin nada guardado, todas abiertas', () => {
    expect(leerSeccionesCerradas().size).toBe(0);
  });

  it('guarda y vuelve a leer', () => {
    guardarSeccionesCerradas(new Set(['general', 'ventas']));
    expect([...leerSeccionesCerradas()]).toEqual(['general', 'ventas']);
  });

  it('ignora lo que no entiende', () => {
    localStorage.setItem(CLAVE, '{no es json');
    expect(leerSeccionesCerradas().size).toBe(0);
    localStorage.setItem(CLAVE, '{"general":true}');
    expect(leerSeccionesCerradas().size).toBe(0);
    localStorage.setItem(CLAVE, '["general",3,null]');
    expect([...leerSeccionesCerradas()]).toEqual(['general']);
  });

  it('si el navegador no deja guardar, sigue funcionando', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(leerSeccionesCerradas().size).toBe(0);
    expect(() => guardarSeccionesCerradas(new Set(['general']))).not.toThrow();
  });
});
