import { CAMPOS_CONOCIDOS, filasDeCambios, MOTIVOS_CONOCIDOS } from './cambios';

/**
 * Copia de los `campos` de `apps/base-backend/src/catalogo-auditoria.ts` (lo que el backend
 * guarda en `antes`/`despues`; allí una prueba falla si falta uno). Si el backend suma uno, se
 * copia aquí y se le pone su texto en `CAMPOS`.
 */
const CAMPOS_DEL_BACKEND = [
  'nombreUsuario',
  'nombreCompleto',
  'nombre',
  'descripcion',
  'esAdministrador',
  'activo',
  'roles',
  'permisos',
  'claveTemporal',
  'debeCambiarContrasena',
  'bloqueadoHasta',
  'intentosFallidos',
  'motivo',
  'empresa',
  'empresaId',
  'venceEn',
  'motivoCierre',
  'sesionesCerradas',
];

/** Los `valores` de `motivoCierre` y `motivo` en `apps/base-backend/src/catalogo-auditoria.ts`. */
const MOTIVOS_CIERRE_DEL_BACKEND = [
  'SALIDA',
  'CAMBIO_CONTRASENA',
  'REUSO',
  'ADMINISTRADOR',
  'USUARIO_DESACTIVADO',
  'EMPRESA_DESACTIVADA',
  'ACCESO_QUITADO',
];
const MOTIVOS_FALLIDO_DEL_BACKEND = [
  'NO_EXISTE',
  'CONTRASENA_INCORRECTA',
  'BLOQUEADO',
  'DESACTIVADO',
  'SIN_EMPRESA',
];

const texto = (t: string, tenue = false) => ({ tipo: 'texto', texto: t, tenue });

describe('qué cambió en un evento', () => {
  it('conoce todos los campos y motivos que registra el backend', () => {
    expect([...CAMPOS_CONOCIDOS].sort()).toEqual([...CAMPOS_DEL_BACKEND].sort());
    expect([...MOTIVOS_CONOCIDOS.cierre].sort()).toEqual([...MOTIVOS_CIERRE_DEL_BACKEND].sort());
    expect([...MOTIVOS_CONOCIDOS.fallido].sort()).toEqual([...MOTIVOS_FALLIDO_DEL_BACKEND].sort());
  });

  it('un texto que cambió, con el nombre del dato en español', () => {
    expect(
      filasDeCambios({ nombreCompleto: 'Mateo Ruis' }, { nombreCompleto: 'Mateo Ruiz' }),
    ).toEqual([
      {
        campo: 'nombreCompleto',
        dato: 'Nombre completo',
        antes: texto('Mateo Ruis'),
        despues: texto('Mateo Ruiz'),
      },
    ]);
  });

  it('las listas marcan lo que se agregó y lo que se quitó', () => {
    const [fila] = filasDeCambios(
      { roles: ['Soporte', 'Operaciones'] },
      { roles: ['Soporte', 'Cumplimiento'] },
    );
    expect(fila.antes).toEqual({
      tipo: 'lista',
      elementos: [
        { texto: 'Soporte', cambio: null },
        { texto: 'Operaciones', cambio: 'quita' },
      ],
    });
    expect(fila.despues).toEqual({
      tipo: 'lista',
      elementos: [
        { texto: 'Soporte', cambio: null },
        { texto: 'Cumplimiento', cambio: 'agrega' },
      ],
    });
  });

  it('al crear (solo después), la lista sin marcas; vacía, «Ninguno»', () => {
    const filas = filasDeCambios(null, { roles: ['Soporte'] });
    expect(filas[0].antes).toEqual(texto('Sin dato', true));
    expect(filas[0].despues).toEqual({
      tipo: 'lista',
      elementos: [{ texto: 'Soporte', cambio: null }],
    });
    const quitado = filasDeCambios({ roles: ['Soporte'] }, { roles: [] });
    expect(quitado[0].antes).toEqual({
      tipo: 'lista',
      elementos: [{ texto: 'Soporte', cambio: 'quita' }],
    });
    expect(quitado[0].despues).toEqual(texto('Ninguno', true));
  });

  it('los permisos con su descripción, si se tiene el catálogo', () => {
    const textoPermiso = (codigo: string) =>
      codigo === 'auth.usuario.ver' ? 'Ver usuarios' : codigo;
    const [fila] = filasDeCambios(
      { permisos: [] },
      { permisos: ['auth.usuario.ver', 'x.y.z'] },
      { textoPermiso },
    );
    expect(fila.despues).toEqual({
      tipo: 'lista',
      elementos: [
        { texto: 'Ver usuarios', cambio: 'agrega' },
        { texto: 'x.y.z', cambio: 'agrega' },
      ],
    });
    // Sin el catálogo, el código.
    const [sinCatalogo] = filasDeCambios(null, { permisos: ['auth.usuario.ver'] });
    expect(sinCatalogo.despues).toEqual({
      tipo: 'lista',
      elementos: [{ texto: 'auth.usuario.ver', cambio: null }],
    });
  });

  it('sí o no, números, oculto, vacío, fechas y motivos', () => {
    const filas = filasDeCambios(
      {
        activo: true,
        debeCambiarContrasena: '[OCULTO]',
        bloqueadoHasta: '2026-11-07T15:06:00.000Z',
        descripcion: '',
      },
      {
        activo: false,
        debeCambiarContrasena: '[OCULTO]',
        bloqueadoHasta: null,
        descripcion: 'Atiende',
        sesionesCerradas: 2,
        motivoCierre: 'REUSO',
        motivo: 'OTRO_MOTIVO',
      },
    );
    const porCampo = Object.fromEntries(filas.map((f) => [f.campo, f]));
    expect(porCampo['activo'].antes).toEqual(texto('Sí'));
    expect(porCampo['activo'].despues).toEqual(texto('No'));
    expect(porCampo['debeCambiarContrasena'].despues).toEqual(texto('Oculto', true));
    expect(porCampo['bloqueadoHasta'].antes).toEqual({
      tipo: 'instante',
      iso: '2026-11-07T15:06:00.000Z',
    });
    expect(porCampo['bloqueadoHasta'].despues).toEqual(texto('Sin dato', true));
    expect(porCampo['descripcion'].antes).toEqual(texto('Vacío', true));
    expect(porCampo['sesionesCerradas'].despues).toEqual(texto('2'));
    expect(porCampo['motivoCierre'].despues).toEqual(
      texto('Se usó una sesión ya renovada (posible robo)'),
    );
    // Un motivo que la pantalla no conoce sale tal cual.
    expect(porCampo['motivo'].despues).toEqual(texto('OTRO_MOTIVO'));
  });

  it('el ingreso con la contraseña correcta pero sin empresa (AUD-02)', () => {
    const [fila] = filasDeCambios(null, { motivo: 'SIN_EMPRESA' });
    expect(fila.despues).toEqual(texto('Sin acceso a ninguna empresa'));
  });

  it('en el orden de la pantalla; lo desconocido al final, con su nombre y en texto', () => {
    const filas = filasDeCambios(null, {
      sesionesCerradas: 1,
      campoNuevo: { a: 1 },
      nombreUsuario: 'ana',
    });
    expect(filas.map((f) => f.dato)).toEqual([
      'Nombre de usuario',
      'Sesiones cerradas',
      'campoNuevo',
    ]);
    expect(filas[2].despues).toEqual(texto('{"a":1}'));
  });

  it('sin cambios, ninguna fila', () => {
    expect(filasDeCambios(null, null)).toEqual([]);
  });
});
