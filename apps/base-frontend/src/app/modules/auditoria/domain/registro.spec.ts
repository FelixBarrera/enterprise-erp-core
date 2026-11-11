import { textoHistoria, tieneHistoria } from './registro';

describe('historia de un registro', () => {
  it('la tienen los usuarios y los roles', () => {
    expect(tieneHistoria('usuario')).toBe(true);
    expect(tieneHistoria('rol')).toBe(true);
    expect(tieneHistoria('sesion')).toBe(false);
    expect(tieneHistoria('empresa')).toBe(false);
    expect(tieneHistoria(null)).toBe(false);
  });

  it('el aviso, con el nombre o sin él', () => {
    expect(textoHistoria('usuario', 'jorge.vera')).toEqual({
      inicio: 'Historia del usuario',
      nombre: 'jorge.vera',
    });
    expect(textoHistoria('rol', null)).toEqual({ inicio: 'Historia de un rol', nombre: null });
    expect(textoHistoria('otra', 'x')).toEqual({ inicio: 'Historia de un registro', nombre: null });
  });
});
