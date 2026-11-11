import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { CatalogoPermisosInvalidoError } from '../../domain/services/catalogo-permisos.js';
import type { CatalogoPermisosDeclarado } from '../ports/out/catalogo-permisos.port.js';
import { PermisosEnMemoria } from '../testing/auth-en-memoria.js';
import { SincronizarPermisosUseCase } from './sincronizar-permisos.use-case.js';

const CATALOGO: CatalogoPermisosDeclarado = [
  {
    modulo: 'auth',
    nombre: 'Usuarios',
    permisos: { 'auth.usuario.ver': 'Ver usuarios', 'auth.rol.ver': 'Ver roles' },
  },
  {
    modulo: 'auditoria',
    nombre: 'Bitácora',
    permisos: { 'auditoria.evento.ver': 'Ver la bitácora' },
  },
];

describe('SincronizarPermisosUseCase', () => {
  const reloj = new RelojFijo('2026-07-15T06:00:00-05:00');
  let permisos: PermisosEnMemoria;
  let transacciones: number;

  beforeEach(() => {
    permisos = new PermisosEnMemoria();
    transacciones = 0;
  });

  const sincronizar = (catalogo: CatalogoPermisosDeclarado = CATALOGO) =>
    new SincronizarPermisosUseCase(
      catalogo,
      permisos,
      {
        ejecutar: (fn) => {
          transacciones++;
          return fn();
        },
      },
      reloj,
    ).execute();

  it('la primera vez crea todos, con la hora del reloj, bloqueando el catálogo en una transacción', async () => {
    await expect(sincronizar()).resolves.toEqual({
      creados: ['auditoria.evento.ver', 'auth.rol.ver', 'auth.usuario.ver'],
      actualizados: [],
      obsoletos: [],
    });
    expect(await permisos.codigosVigentes()).toEqual([
      'auditoria.evento.ver',
      'auth.rol.ver',
      'auth.usuario.ver',
    ]);
    expect(transacciones).toBe(1);
    expect(permisos.bloqueos).toBe(1);
    expect(permisos.escrituras).toEqual([{ tipo: 'crear', cantidad: 3, ahora: reloj.ahora() }]);
  });

  it('la segunda vez no escribe nada', async () => {
    await sincronizar();
    permisos.escrituras.length = 0;

    await expect(sincronizar()).resolves.toEqual({ creados: [], actualizados: [], obsoletos: [] });
    expect(permisos.escrituras).toEqual([]);
  });

  it('actualiza descripciones, reactiva y marca obsoletos en una sola escritura, sin borrar', async () => {
    permisos.agregar('auth.usuario.ver', 'Ver a los usuarios');
    permisos.agregar('auth.rol.ver', 'Ver roles', true);
    permisos.agregar('auth.rol.borrar', 'Borrar roles');

    await expect(sincronizar()).resolves.toEqual({
      creados: ['auditoria.evento.ver'],
      actualizados: ['auth.rol.ver', 'auth.usuario.ver'],
      obsoletos: ['auth.rol.borrar'],
    });
    expect(permisos.escrituras.map((e) => [e.tipo, e.cantidad])).toEqual([
      ['crear', 1],
      ['actualizar', 3],
    ]);
    expect(await permisos.listar()).toEqual([
      expect.objectContaining({ codigo: 'auditoria.evento.ver', obsoleto: false }),
      expect.objectContaining({ codigo: 'auth.rol.borrar', obsoleto: true }),
      expect.objectContaining({ codigo: 'auth.rol.ver', obsoleto: false }),
      expect.objectContaining({ codigo: 'auth.usuario.ver', descripcion: 'Ver usuarios' }),
    ]);
  });

  it('con un catálogo mal escrito falla sin abrir la transacción ni escribir', async () => {
    await expect(
      sincronizar([
        { modulo: 'auth', nombre: 'Usuarios', permisos: { 'ventas.factura.ver': 'Ver facturas' } },
      ]),
    ).rejects.toThrow(CatalogoPermisosInvalidoError);
    expect(transacciones).toBe(0);
    expect(permisos.filas.size).toBe(0);
  });
});
