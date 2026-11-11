import {
  conContrasenaCambiada,
  type Sesion,
  tienePermiso,
  trabajaEnVariasEmpresas,
} from './sesion';

function sesion(cambios: Partial<Sesion> = {}): Sesion {
  return {
    usuario: {
      id: 'u1',
      nombreUsuario: 'ana',
      nombreCompleto: 'Ana',
      debeCambiarContrasena: false,
    },
    empresaActiva: { id: 'e1', nombre: 'Empresa Uno' },
    empresas: [{ id: 'e1', nombre: 'Empresa Uno' }],
    esAdministrador: false,
    permisos: ['auth.usuario.ver'],
    zonaNegocio: 'America/Guayaquil',
    sesionVenceEn: '2026-07-15T18:00:00.000Z',
    ...cambios,
  };
}

describe('tienePermiso', () => {
  it('sin sesión, nunca', () => {
    expect(tienePermiso(null, 'auth.usuario.ver')).toBe(false);
  });

  it('con el permiso en la lista, sí; sin él, no', () => {
    expect(tienePermiso(sesion(), 'auth.usuario.ver')).toBe(true);
    expect(tienePermiso(sesion(), 'auth.rol.ver')).toBe(false);
  });

  it('el Administrador tiene todos', () => {
    expect(tienePermiso(sesion({ esAdministrador: true, permisos: [] }), 'auth.rol.ver')).toBe(
      true,
    );
  });
});

describe('trabajaEnVariasEmpresas', () => {
  it('sin sesión o con una sola empresa, no', () => {
    expect(trabajaEnVariasEmpresas(null)).toBe(false);
    expect(trabajaEnVariasEmpresas(sesion())).toBe(false);
  });

  it('con dos o más, sí', () => {
    const empresas = [
      { id: 'e1', nombre: 'Uno' },
      { id: 'e2', nombre: 'Dos' },
    ];
    expect(trabajaEnVariasEmpresas(sesion({ empresas }))).toBe(true);
  });
});

describe('conContrasenaCambiada', () => {
  it('quita la marca de contraseña temporal y deja todo lo demás igual', () => {
    const antes = sesion({ usuario: { ...sesion().usuario, debeCambiarContrasena: true } });
    const despues = conContrasenaCambiada(antes);
    expect(despues.usuario.debeCambiarContrasena).toBe(false);
    expect(despues).toEqual({
      ...antes,
      usuario: { ...antes.usuario, debeCambiarContrasena: false },
    });
    expect(antes.usuario.debeCambiarContrasena).toBe(true);
  });
});
