import {
  cambiosDeRol,
  cantidadDeCambios,
  cifrasDelRol,
  nuevoRol,
  type Rol,
  type RolResumen,
  textoCambiosSinGuardar,
  textoPermisosDelRol,
  textoUsuariosDelRol,
} from './rol';

const ROL: Rol = {
  id: 'r-1',
  nombre: 'Caja',
  descripcion: 'Cobra y emite recibos',
  esAdministrador: false,
  activo: true,
  cantidadUsuarios: 2,
  permisos: [],
  creado: null,
  modificado: null,
};

const RESUMEN: RolResumen = {
  id: 'r-1',
  nombre: 'Caja',
  descripcion: null,
  esAdministrador: false,
  activo: true,
  cantidadUsuarios: 1,
  cantidadPermisos: 3,
};

describe('cambiosDeRol', () => {
  it('lo mismo (con espacios en los extremos): sin cambios', () => {
    expect(
      cambiosDeRol(ROL, { nombre: ' Caja ', descripcion: 'Cobra y emite recibos ' }),
    ).toBeNull();
  });

  it('otro nombre: solo el nombre, tal cual', () => {
    expect(cambiosDeRol(ROL, { nombre: 'Caja 2 ', descripcion: 'Cobra y emite recibos' })).toEqual({
      nombre: 'Caja 2 ',
    });
  });

  it('descripción vacía: la quita (null)', () => {
    expect(cambiosDeRol(ROL, { nombre: 'Caja', descripcion: '  ' })).toEqual({ descripcion: null });
  });

  it('sin descripción y sigue vacía: sin cambios', () => {
    expect(
      cambiosDeRol({ ...ROL, descripcion: null }, { nombre: 'Caja', descripcion: '' }),
    ).toBeNull();
  });

  it('los dos cambian', () => {
    const cambios = cambiosDeRol(ROL, { nombre: 'Tesorería', descripcion: 'Paga' });
    expect(cambios).toEqual({ nombre: 'Tesorería', descripcion: 'Paga' });
    expect(cantidadDeCambios(cambios)).toBe(2);
    expect(cantidadDeCambios(null)).toBe(0);
  });
});

describe('textos del rol', () => {
  it('cambios sin guardar', () => {
    expect(textoCambiosSinGuardar(1)).toBe('1 cambio sin guardar');
    expect(textoCambiosSinGuardar(2)).toBe('2 cambios sin guardar');
  });

  it('usuarios del rol', () => {
    expect(textoUsuariosDelRol(0)).toBe('Ningún usuario activo tiene este rol');
    expect(textoUsuariosDelRol(1)).toBe('1 usuario activo tiene este rol');
    expect(textoUsuariosDelRol(2)).toBe('2 usuarios activos tienen este rol');
  });

  it('permisos en la lista: el Administrador, «Todos»', () => {
    expect(textoPermisosDelRol(RESUMEN)).toBe('3');
    expect(textoPermisosDelRol({ ...RESUMEN, esAdministrador: true })).toBe('Todos');
  });

  it('cifras de la tarjeta', () => {
    expect(cifrasDelRol(RESUMEN)).toBe('3 permisos · 1 usuario');
    expect(cifrasDelRol({ ...RESUMEN, cantidadPermisos: 1, cantidadUsuarios: 0 })).toBe(
      '1 permiso · 0 usuarios',
    );
    expect(cifrasDelRol({ ...RESUMEN, esAdministrador: true, cantidadUsuarios: 2 })).toBe(
      'Todos los permisos · 2 usuarios',
    );
  });
});

describe('nuevoRol', () => {
  it('con descripción: tal cual (el backend recorta)', () => {
    expect(nuevoRol({ nombre: ' Caja ', descripcion: 'Cobra' }, ['auth.rol.ver'])).toEqual({
      nombre: ' Caja ',
      descripcion: 'Cobra',
      permisos: ['auth.rol.ver'],
    });
  });

  it('descripción vacía o con espacios: null; sin permisos, lista vacía', () => {
    expect(nuevoRol({ nombre: 'Caja', descripcion: '   ' }, [])).toEqual({
      nombre: 'Caja',
      descripcion: null,
      permisos: [],
    });
  });
});
