import { CATALOGO_PERMISOS } from '../../../../catalogo-permisos.js';
import { CatalogoPermisos, CatalogoPermisosInvalidoError } from './catalogo-permisos.js';

const AUTH = {
  modulo: 'auth',
  nombre: 'Usuarios y roles',
  permisos: { 'auth.usuario.ver': 'Ver usuarios', 'auth.rol.ver': 'Ver roles' },
};
const VENTAS = {
  modulo: 'ventas',
  nombre: 'Ventas',
  permisos: { 'ventas.factura.anular': 'Anular facturas' },
};

describe('CatalogoPermisos', () => {
  it('junta los de todos los módulos, por código', () => {
    const catalogo = CatalogoPermisos.desde([VENTAS, AUTH]);
    expect(catalogo.permisos.map((p) => p.codigo)).toEqual([
      'auth.rol.ver',
      'auth.usuario.ver',
      'ventas.factura.anular',
    ]);
    expect(catalogo.incluye('auth.rol.ver')).toBe(true);
    expect(catalogo.incluye('auth.rol.borrar')).toBe(false);
  });

  it('limpia la descripción como cualquier texto guardado', () => {
    const catalogo = CatalogoPermisos.desde([
      { modulo: 'auth', nombre: 'Usuarios', permisos: { 'auth.usuario.ver': '  Ver   usuarios ' } },
    ]);
    expect(catalogo.permisos).toEqual([
      { codigo: 'auth.usuario.ver', descripcion: 'Ver usuarios' },
    ]);
  });

  it.each([
    [
      { modulo: 'auth', nombre: 'Usuarios', permisos: { 'auth.usuario': 'x' } },
      'no tiene el formato',
    ],
    [
      { modulo: 'auth', nombre: 'Usuarios', permisos: { 'ventas.factura.ver': 'x' } },
      'tiene que empezar por «auth.»',
    ],
    [
      { modulo: 'auth', nombre: 'Usuarios', permisos: { 'auth.usuario.ver': '   ' } },
      'de 1 a 150 caracteres',
    ],
    [
      { modulo: 'auth', nombre: 'Usuarios', permisos: { 'auth.usuario.ver': 'x'.repeat(151) } },
      'de 1 a 150',
    ],
  ])('un módulo mal declarado impide arrancar (%#)', (declaracion, motivo) => {
    expect(() => CatalogoPermisos.desde([declaracion])).toThrow(CatalogoPermisosInvalidoError);
    expect(() => CatalogoPermisos.desde([declaracion])).toThrow(motivo);
  });

  it('un módulo declarado dos veces impide arrancar', () => {
    expect(() => CatalogoPermisos.desde([AUTH, AUTH])).toThrow(
      'Catálogo de permisos inválido: el módulo «auth» está declarado dos veces',
    );
  });

  it.each(['   ', 'x'.repeat(61)])(
    'un módulo sin nombre o con uno largo impide arrancar',
    (nombre) => {
      expect(() => CatalogoPermisos.desde([{ ...AUTH, nombre }])).toThrow(
        'el nombre del módulo «auth» tiene que tener de 1 a 60 caracteres',
      );
    },
  );

  it('grupos: por módulo, en el orden declarado, con el nombre limpio y sin los vacíos', () => {
    const catalogo = CatalogoPermisos.desde([
      VENTAS,
      { ...AUTH, nombre: '  Usuarios   y roles ' },
      { modulo: 'vacio', nombre: 'Vacío', permisos: {} },
    ]);
    expect(catalogo.grupos).toEqual([
      {
        modulo: 'ventas',
        nombre: 'Ventas',
        permisos: [{ codigo: 'ventas.factura.anular', descripcion: 'Anular facturas' }],
      },
      {
        modulo: 'auth',
        nombre: 'Usuarios y roles',
        permisos: [
          { codigo: 'auth.usuario.ver', descripcion: 'Ver usuarios' },
          { codigo: 'auth.rol.ver', descripcion: 'Ver roles' },
        ],
      },
    ]);
  });

  it('el catálogo real de la API es válido', () => {
    const catalogo = CatalogoPermisos.desde(CATALOGO_PERMISOS);
    expect(catalogo.incluye('auth.usuario.ver')).toBe(true);
    expect(catalogo.incluye('auditoria.evento.ver')).toBe(true);
    expect(catalogo.incluye('empresas.empresa.editar')).toBe(true);
  });

  describe('planContra()', () => {
    const catalogo = CatalogoPermisos.desde([AUTH]);
    const guardado = (codigo: string, descripcion: string, obsoleto = false) => ({
      id: `id-${codigo}`,
      codigo,
      descripcion,
      obsoleto,
    });

    it('con la base vacía, crea todos', () => {
      expect(catalogo.planContra([])).toEqual({
        nuevos: [
          { codigo: 'auth.rol.ver', descripcion: 'Ver roles' },
          { codigo: 'auth.usuario.ver', descripcion: 'Ver usuarios' },
        ],
        cambiados: [],
        obsoletos: [],
      });
    });

    it('con la base igual al código, no hace nada', () => {
      const plan = catalogo.planContra([
        guardado('auth.rol.ver', 'Ver roles'),
        guardado('auth.usuario.ver', 'Ver usuarios'),
      ]);
      expect(plan).toEqual({ nuevos: [], cambiados: [], obsoletos: [] });
    });

    it('actualiza la descripción, reactiva el que volvió y marca obsoleto el que salió', () => {
      const plan = catalogo.planContra([
        guardado('auth.rol.ver', 'Ver los roles'),
        guardado('auth.usuario.ver', 'Ver usuarios', true),
        guardado('auth.rol.borrar', 'Borrar roles'),
        guardado('auth.viejo.ver', 'Ya obsoleto', true),
      ]);
      expect(plan.nuevos).toEqual([]);
      expect(plan.cambiados).toEqual([
        guardado('auth.rol.ver', 'Ver roles'),
        guardado('auth.usuario.ver', 'Ver usuarios'),
      ]);
      // El que ya estaba obsoleto no se vuelve a escribir.
      expect(plan.obsoletos).toEqual([guardado('auth.rol.borrar', 'Borrar roles', true)]);
    });
  });
});
