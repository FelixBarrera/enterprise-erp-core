import {
  accionesDeUsuario,
  esAccionDePeligro,
  esNombreUsuarioValido,
  normalizarNombreUsuario,
  cambiosDeUsuario,
  cantidadDeCambiosDeRoles,
  DESCRIPCION_DESACTIVADO,
  describirNavegador,
  estadosDeUsuario,
  filasDeRoles,
  NOTA_SIN_TODOS_LOS_PERMISOS,
  NOTA_SOLO_ADMINISTRADOR_DA,
  NOTA_SOLO_ADMINISTRADOR_QUITA,
  type ReglaAccionesUsuario,
  type RolAsignable,
  type RolDeUsuario,
  rolesEnOrden,
  textoRolDeUsuario,
  textoRolesDeUsuario,
  textoSesionesCerradas,
  type Usuario,
  type UsuarioResumen,
} from './usuario';

// Los datos de prueba van aquí: domain/ no usa los de application/testing/ (lo prohíbe el lint).
function usuarioDePrueba(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    nombreUsuario: 'jorge.vera',
    nombreCompleto: 'Jorge Vera',
    activo: true,
    bloqueadoHasta: null,
    ultimoIngresoEn: null,
    roles: [],
    debeCambiarContrasena: false,
    trabajaEnOtrasEmpresas: false,
    sesiones: [],
    creado: null,
    modificado: null,
    ...cambios,
  };
}

const usuarioResumenDePrueba = (cambios: Partial<UsuarioResumen> = {}): UsuarioResumen => {
  const { id, nombreUsuario, nombreCompleto, activo, bloqueadoHasta, ultimoIngresoEn, roles } =
    usuarioDePrueba();
  return {
    id,
    nombreUsuario,
    nombreCompleto,
    activo,
    bloqueadoHasta,
    ultimoIngresoEn,
    roles,
    debeCambiarContrasena: false,
    ...cambios,
  };
};

const asignable = (id: string, nombre: string, sePuedeDar: boolean): RolAsignable => ({
  id,
  nombre,
  descripcion: null,
  esAdministrador: id === 'r-admin',
  sePuedeDar,
});

const rolesAsignablesDePrueba = (): RolAsignable[] => [
  asignable('r-admin', 'Administrador', false),
  asignable('r-consulta', 'Consulta', true),
  asignable('r-cumplimiento', 'Cumplimiento', false),
  asignable('r-soporte', 'Soporte', true),
];

const soporte: RolDeUsuario = {
  id: 'r-soporte',
  nombre: 'Soporte',
  esAdministrador: false,
  activo: true,
};
const admin: RolDeUsuario = {
  id: 'r-admin',
  nombre: 'Administrador',
  esAdministrador: true,
  activo: true,
};
const operaciones: RolDeUsuario = {
  id: 'r-operaciones',
  nombre: 'Operaciones',
  esAdministrador: false,
  activo: false,
};
const JEFE = { editable: true, esAdministrador: false };
const ADMINISTRADOR = { editable: true, esAdministrador: true };

describe('estadosDeUsuario', () => {
  it('activo, sin más: «Activo»', () => {
    expect(estadosDeUsuario(usuarioResumenDePrueba())).toEqual([
      { texto: 'Activo', tipo: 'exito' },
    ]);
  });

  it('desactivado: solo «Desactivado», aunque esté bloqueado', () => {
    const usuario = usuarioDePrueba({ activo: false, bloqueadoHasta: '2026-11-06T15:00:00Z' });
    expect(estadosDeUsuario(usuario)).toEqual([{ texto: 'Desactivado', tipo: 'neutro' }]);
  });

  it('una fila de la lista con contraseña temporal lo dice', () => {
    expect(estadosDeUsuario(usuarioResumenDePrueba({ debeCambiarContrasena: true }))).toEqual([
      { texto: 'Debe cambiar su contraseña', tipo: 'aviso' },
    ]);
  });

  it('bloqueado y con contraseña temporal: las dos', () => {
    const usuario = usuarioDePrueba({
      bloqueadoHasta: '2026-11-06T15:00:00Z',
      debeCambiarContrasena: true,
    });
    expect(estadosDeUsuario(usuario).map((e) => e.texto)).toEqual([
      'Bloqueado',
      'Debe cambiar su contraseña',
    ]);
  });
});

describe('textos de los roles', () => {
  it('un desactivado lo dice', () => {
    expect(textoRolDeUsuario(operaciones)).toBe('Operaciones (desactivado)');
    expect(textoRolesDeUsuario([soporte, operaciones])).toBe('Soporte · Operaciones (desactivado)');
  });
});

describe('cambios', () => {
  it('el nombre: los espacios de los extremos no cuentan', () => {
    const usuario = usuarioDePrueba();
    expect(cambiosDeUsuario(usuario, '  Jorge Vera ')).toBeNull();
    expect(cambiosDeUsuario(usuario, 'Jorge Vera Ruiz')).toEqual({
      nombreCompleto: 'Jorge Vera Ruiz',
    });
  });

  it('los roles: cada uno que se agrega o se quita', () => {
    expect(cantidadDeCambiosDeRoles(new Set(['a', 'b']), new Set(['b', 'c']))).toBe(2);
    expect(cantidadDeCambiosDeRoles(new Set(['a']), new Set(['a']))).toBe(0);
  });
});

describe('filasDeRoles', () => {
  const asignables = rolesAsignablesDePrueba();
  const fila = (filas: ReturnType<typeof filasDeRoles>, id: string) =>
    filas.find((f) => f.id === id)!;

  it('los activos en su orden y, al final, el desactivado que ya tiene', () => {
    const filas = filasDeRoles(
      asignables,
      [soporte, operaciones],
      new Set(['r-soporte', 'r-operaciones']),
      JEFE,
    );
    expect(filas.map((f) => f.id)).toEqual([
      'r-admin',
      'r-consulta',
      'r-cumplimiento',
      'r-soporte',
      'r-operaciones',
    ]);
    const desactivado = fila(filas, 'r-operaciones');
    expect(desactivado).toMatchObject({
      desactivado: true,
      marcado: true,
      cambiable: true,
      nota: null,
    });
    expect(desactivado.descripcion).toBe(DESCRIPCION_DESACTIVADO);
  });

  it('quien no es administrador: no da el Administrador ni lo que no puede; sí lo que puede', () => {
    const filas = filasDeRoles(asignables, [soporte], new Set(['r-soporte']), JEFE);
    expect(fila(filas, 'r-admin')).toMatchObject({
      cambiable: false,
      nota: NOTA_SOLO_ADMINISTRADOR_DA,
    });
    expect(fila(filas, 'r-cumplimiento')).toMatchObject({
      cambiable: false,
      nota: NOTA_SIN_TODOS_LOS_PERMISOS,
    });
    expect(fila(filas, 'r-consulta')).toMatchObject({ cambiable: true, nota: null });
  });

  it('quitar: cualquiera, salvo el Administrador (solo un administrador)', () => {
    const roles = [admin, { ...soporte, id: 'r-cumplimiento', nombre: 'Cumplimiento' }];
    const marcados = new Set(['r-admin', 'r-cumplimiento']);
    const deJefe = filasDeRoles(asignables, roles, marcados, JEFE);
    expect(fila(deJefe, 'r-admin')).toMatchObject({
      cambiable: false,
      nota: NOTA_SOLO_ADMINISTRADOR_QUITA,
    });
    expect(fila(deJefe, 'r-cumplimiento').cambiable).toBe(true);
    const deAdministrador = filasDeRoles(asignables, roles, marcados, ADMINISTRADOR);
    expect(fila(deAdministrador, 'r-admin').cambiable).toBe(true);
  });

  it('«Se agrega» y «Se quita»; volver a marcar lo que tenía se puede', () => {
    const filas = filasDeRoles(asignables, [soporte], new Set(['r-consulta']), JEFE);
    expect(fila(filas, 'r-consulta')).toMatchObject({ nota: 'Se agrega', esCambio: true });
    expect(fila(filas, 'r-soporte')).toMatchObject({ nota: 'Se quita', cambiable: true });
  });

  it('solo lectura: nada se cambia y sin motivos', () => {
    const filas = filasDeRoles(asignables, [soporte], new Set(['r-soporte']), {
      editable: false,
      esAdministrador: true,
    });
    expect(filas.every((f) => !f.cambiable && f.nota === null)).toBe(true);
  });

  it('rolesEnOrden: los marcados en el orden de las filas', () => {
    const filas = filasDeRoles(asignables, [], new Set(), ADMINISTRADOR);
    expect(rolesEnOrden(filas, new Set(['r-soporte', 'r-admin']))).toEqual([
      'r-admin',
      'r-soporte',
    ]);
  });
});

describe('describirNavegador', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      'Chrome en Windows',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari en iPhone',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0',
      'Edge en Windows',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox en Linux'],
    [
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
      'Chrome en Android',
    ],
    ['curl/8.5', 'Navegador desconocido'],
    [null, 'Navegador desconocido'],
  ])('%s → %s', (agente, esperado) => {
    expect(describirNavegador(agente)).toBe(esperado);
  });
});

describe('nombre de usuario', () => {
  it('normaliza como el backend: sin espacios en los extremos y en minúsculas', () => {
    expect(normalizarNombreUsuario('  Lucia.Torres ')).toBe('lucia.torres');
  });

  it.each(['lucia.torres', 'Ana_P-2', 'abc', 'a'.repeat(50)])('vale «%s»', (texto) => {
    expect(esNombreUsuarioValido(texto)).toBe(true);
  });

  it.each(['ab', 'a'.repeat(51), 'lucía', 'ana pérez', 'ana@erp', 'año'])(
    'no vale «%s»',
    (texto) => {
      expect(esNombreUsuarioValido(texto)).toBe(false);
    },
  );
});

describe('accionesDeUsuario', () => {
  const todas: ReglaAccionesUsuario = {
    esSuFicha: false,
    puedeRestablecer: true,
    puedeDesactivar: true,
    puedeQuitarAcceso: true,
  };

  it('activo y sin bloqueo: contraseña temporal, cerrar sesiones, quitar acceso y desactivar', () => {
    expect(accionesDeUsuario(usuarioDePrueba(), todas)).toEqual([
      'contrasena-temporal',
      'cerrar-sesiones',
      'quitar-acceso',
      'desactivar',
    ]);
  });

  it('bloqueado: «Desbloquear» primero', () => {
    const bloqueado = usuarioDePrueba({ bloqueadoHasta: '2026-11-06T15:00:00.000Z' });
    expect(accionesDeUsuario(bloqueado, todas)[0]).toBe('desbloquear');
  });

  it('desactivado: solo reactivar y quitar el acceso', () => {
    const desactivado = usuarioDePrueba({
      activo: false,
      bloqueadoHasta: '2026-11-06T15:00:00.000Z',
    });
    expect(accionesDeUsuario(desactivado, todas)).toEqual(['reactivar', 'quitar-acceso']);
  });

  it('su propia ficha: solo desbloquear y cerrar las otras sesiones', () => {
    const bloqueado = usuarioDePrueba({ bloqueadoHasta: '2026-11-06T15:00:00.000Z' });
    expect(accionesDeUsuario(bloqueado, { ...todas, esSuFicha: true })).toEqual([
      'desbloquear',
      'cerrar-sesiones',
    ]);
    expect(
      accionesDeUsuario(usuarioDePrueba({ activo: false }), { ...todas, esSuFicha: true }),
    ).toEqual(['reactivar']);
  });

  it('cada una con su permiso', () => {
    const bloqueado = usuarioDePrueba({ bloqueadoHasta: '2026-11-06T15:00:00.000Z' });
    const sin = {
      esSuFicha: false,
      puedeRestablecer: false,
      puedeDesactivar: false,
      puedeQuitarAcceso: false,
    };
    expect(accionesDeUsuario(bloqueado, sin)).toEqual([]);
    expect(accionesDeUsuario(bloqueado, { ...sin, puedeRestablecer: true })).toEqual([
      'desbloquear',
      'contrasena-temporal',
      'cerrar-sesiones',
    ]);
    expect(accionesDeUsuario(bloqueado, { ...sin, puedeDesactivar: true })).toEqual(['desactivar']);
    expect(accionesDeUsuario(bloqueado, { ...sin, puedeQuitarAcceso: true })).toEqual([
      'quitar-acceso',
    ]);
  });

  it('quitar el acceso y desactivar son de peligro', () => {
    expect(esAccionDePeligro('quitar-acceso')).toBe(true);
    expect(esAccionDePeligro('desactivar')).toBe(true);
    expect(esAccionDePeligro('desbloquear')).toBe(false);
  });
});

describe('textoSesionesCerradas', () => {
  it('de otro: cuántas, en singular o plural, o que no tenía', () => {
    expect(textoSesionesCerradas(0, false)).toBe('No tenía sesiones abiertas');
    expect(textoSesionesCerradas(1, false)).toBe('Se cerró 1 sesión');
    expect(textoSesionesCerradas(3, false)).toBe('Se cerraron 3 sesiones');
  });

  it('las suyas: las otras (la actual sigue)', () => {
    expect(textoSesionesCerradas(0, true)).toBe('No tenía otras sesiones abiertas');
    expect(textoSesionesCerradas(1, true)).toBe('Se cerró su otra sesión');
    expect(textoSesionesCerradas(2, true)).toBe('Se cerraron sus otras 2 sesiones');
  });
});
