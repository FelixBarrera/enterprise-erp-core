import {
  alternarGrupo,
  alternarPermiso,
  cambioDePermiso,
  cantidadDeCambiosDePermisos,
  codigosDelCatalogo,
  filtrarCatalogo,
  type GrupoPermisos,
  marcaDelGrupo,
  normalizarBusqueda,
  permisosEnOrden,
  type ReglaPermisos,
  sePuedeCambiar,
  textoMarcados,
} from './permisos-rol';

const USUARIOS: GrupoPermisos = {
  modulo: 'auth',
  nombre: 'Usuarios y roles',
  permisos: [
    { codigo: 'a.ver', descripcion: 'Ver usuarios' },
    { codigo: 'a.clave', descripcion: 'Dar contraseña temporal' },
    { codigo: 'a.rol', descripcion: 'Ver roles' },
  ],
};
const EMPRESA: GrupoPermisos = {
  modulo: 'empresas',
  nombre: 'Empresa',
  permisos: [{ codigo: 'e.editar', descripcion: 'Editar la empresa' }],
};
const CATALOGO = [USUARIOS, EMPRESA];

const conjunto = (...codigos: string[]) => new Set(codigos);
const ordenado = (s: ReadonlySet<string>) => [...s].sort();

/** Quien opera tiene todo (el administrador). */
const TODO: ReglaPermisos = { originales: conjunto(), puedeDar: () => true };

describe('permisos-rol', () => {
  it('codigosDelCatalogo y textoMarcados', () => {
    expect(codigosDelCatalogo(CATALOGO)).toEqual(['a.ver', 'a.clave', 'a.rol', 'e.editar']);
    expect(textoMarcados(8, 12)).toBe('8 de 12');
  });

  it('normalizarBusqueda: sin mayúsculas, tildes ni espacios en los extremos', () => {
    expect(normalizarBusqueda('  Contraseña ÚNICA ')).toBe('contrasena unica');
  });

  it('cambioDePermiso: se agrega, se quita o nada', () => {
    const originales = conjunto('a.ver');
    expect(cambioDePermiso('a.rol', conjunto('a.ver', 'a.rol'), originales)).toBe('agrega');
    expect(cambioDePermiso('a.ver', conjunto(), originales)).toBe('quita');
    expect(cambioDePermiso('a.ver', conjunto('a.ver'), originales)).toBeNull();
    expect(cambioDePermiso('a.rol', conjunto(), originales)).toBeNull();
  });

  describe('escalada', () => {
    // Quien opera solo tiene «a.ver»; el rol ya tenía «a.clave».
    const regla: ReglaPermisos = {
      originales: conjunto('a.clave'),
      puedeDar: (c) => c === 'a.ver',
    };

    it('sePuedeCambiar: lo que tiene, o lo que el rol ya tenía', () => {
      expect(sePuedeCambiar('a.ver', regla)).toBe(true);
      expect(sePuedeCambiar('a.clave', regla)).toBe(true);
      expect(sePuedeCambiar('a.rol', regla)).toBe(false);
    });

    it('alternarPermiso: lo que no puede dar queda igual', () => {
      expect(ordenado(alternarPermiso('a.rol', conjunto(), regla))).toEqual([]);
      expect(ordenado(alternarPermiso('a.ver', conjunto(), regla))).toEqual(['a.ver']);
      // Quitar y volver a poner lo que el rol ya tenía.
      expect(ordenado(alternarPermiso('a.clave', conjunto('a.clave'), regla))).toEqual([]);
      expect(ordenado(alternarPermiso('a.clave', conjunto(), regla))).toEqual(['a.clave']);
    });

    it('alternarGrupo: marca solo lo que puede; la segunda vez desmarca eso', () => {
      const una = alternarGrupo(USUARIOS, conjunto(), regla);
      expect(ordenado(una)).toEqual(['a.clave', 'a.ver']);
      expect(marcaDelGrupo(USUARIOS, una)).toBe('parcial');
      expect(ordenado(alternarGrupo(USUARIOS, una, regla))).toEqual([]);
    });

    it('alternarGrupo no toca lo que no puede cambiar, aunque esté marcado', () => {
      // «a.rol» marcado sin poder cambiarlo (llegó así): queda.
      const reglaSinRol: ReglaPermisos = { originales: conjunto(), puedeDar: (c) => c === 'a.ver' };
      expect(ordenado(alternarGrupo(USUARIOS, conjunto('a.ver', 'a.rol'), reglaSinRol))).toEqual([
        'a.rol',
      ]);
    });
  });

  it('alternarGrupo con todo: marca el grupo entero, luego lo desmarca; los otros quedan', () => {
    const todo = alternarGrupo(USUARIOS, conjunto('e.editar', 'a.ver'), TODO);
    expect(ordenado(todo)).toEqual(['a.clave', 'a.rol', 'a.ver', 'e.editar']);
    expect(marcaDelGrupo(USUARIOS, todo)).toBe('todo');
    const nada = alternarGrupo(USUARIOS, todo, TODO);
    expect(ordenado(nada)).toEqual(['e.editar']);
    expect(marcaDelGrupo(USUARIOS, nada)).toBe('ninguno');
  });

  it('cantidadDeCambiosDePermisos: cada agregado y cada quitado', () => {
    expect(cantidadDeCambiosDePermisos(conjunto('a', 'b'), conjunto('b', 'a'))).toBe(0);
    expect(cantidadDeCambiosDePermisos(conjunto('a', 'c'), conjunto('a', 'b'))).toBe(2);
    expect(cantidadDeCambiosDePermisos(conjunto(), conjunto('a'))).toBe(1);
  });

  describe('filtrarCatalogo', () => {
    it('sin filtro: todos los grupos con todos sus permisos', () => {
      const grupos = filtrarCatalogo(CATALOGO, conjunto(), { texto: '', soloMarcados: false });
      expect(grupos.map((g) => g.visibles.length)).toEqual([3, 1]);
    });

    it('buscar sin tildes ni mayúsculas; los grupos sin coincidencias no salen', () => {
      const grupos = filtrarCatalogo(CATALOGO, conjunto(), {
        texto: 'CONTRASENA',
        soloMarcados: false,
      });
      expect(grupos).toHaveLength(1);
      expect(grupos[0].grupo).toBe(USUARIOS);
      expect(grupos[0].visibles.map((p) => p.codigo)).toEqual(['a.clave']);
    });

    it('solo los marcados', () => {
      const grupos = filtrarCatalogo(CATALOGO, conjunto('e.editar'), {
        texto: '',
        soloMarcados: true,
      });
      expect(grupos.map((g) => g.grupo.modulo)).toEqual(['empresas']);
    });

    it('nada coincide: ningún grupo', () => {
      expect(filtrarCatalogo(CATALOGO, conjunto(), { texto: 'zzz', soloMarcados: false })).toEqual(
        [],
      );
    });
  });

  it('permisosEnOrden: los marcados, en el orden del catálogo', () => {
    expect(permisosEnOrden(CATALOGO, conjunto('e.editar', 'a.rol', 'a.ver'))).toEqual([
      'a.ver',
      'a.rol',
      'e.editar',
    ]);
  });
});
