import { fichaDelRegistro, historiaDelRegistro } from './enlaces';

const ID = '0190a4f2-1c2b-7000-8000-000000000102';
const todos = () => true;

describe('enlaces de la bitácora', () => {
  it('la ficha de un usuario o un rol', () => {
    expect(fichaDelRegistro('usuario', ID, todos)).toEqual({ ruta: ['/usuarios', ID] });
    expect(fichaDelRegistro('rol', ID, todos)).toEqual({ ruta: ['/roles', ID] });
  });

  it('sin el permiso de esa pantalla, sin ficha; una sesión o la empresa, tampoco', () => {
    const tiene = vi.fn((permiso: string) => permiso === 'auth.rol.ver');
    expect(fichaDelRegistro('usuario', ID, tiene)).toBeNull();
    expect(tiene).toHaveBeenCalledWith('auth.usuario.ver');
    expect(fichaDelRegistro('rol', ID, tiene)).not.toBeNull();
    expect(fichaDelRegistro('sesion', ID, todos)).toBeNull();
    expect(fichaDelRegistro('empresa', ID, todos)).toBeNull();
    expect(fichaDelRegistro(null, null, todos)).toBeNull();
  });

  it('la historia, solo de usuarios y roles', () => {
    expect(historiaDelRegistro('usuario', ID)).toEqual({
      ruta: ['/bitacora'],
      parametros: { entidad: 'usuario', entidadId: ID },
    });
    expect(historiaDelRegistro('empresa', ID)).toBeNull();
    expect(historiaDelRegistro('rol', null)).toBeNull();
  });
});
