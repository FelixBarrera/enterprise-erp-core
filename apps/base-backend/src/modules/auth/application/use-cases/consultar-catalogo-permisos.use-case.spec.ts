import { ConsultarCatalogoPermisosUseCase } from './consultar-catalogo-permisos.use-case.js';

describe('ConsultarCatalogoPermisosUseCase', () => {
  it('los permisos por módulo, en el orden declarado, con su nombre', () => {
    const casoDeUso = new ConsultarCatalogoPermisosUseCase([
      {
        modulo: 'ventas',
        nombre: 'Ventas',
        permisos: { 'ventas.factura.ver': 'Ver facturas', 'ventas.factura.anular': 'Anular' },
      },
      { modulo: 'auth', nombre: 'Usuarios y roles', permisos: { 'auth.rol.ver': 'Ver roles' } },
    ]);
    expect(casoDeUso.execute()).toEqual([
      {
        modulo: 'ventas',
        nombre: 'Ventas',
        permisos: [
          { codigo: 'ventas.factura.ver', descripcion: 'Ver facturas' },
          { codigo: 'ventas.factura.anular', descripcion: 'Anular' },
        ],
      },
      {
        modulo: 'auth',
        nombre: 'Usuarios y roles',
        permisos: [{ codigo: 'auth.rol.ver', descripcion: 'Ver roles' }],
      },
    ]);
  });

  it('un catálogo mal escrito no deja crear el caso de uso (la API no arranca)', () => {
    expect(
      () =>
        new ConsultarCatalogoPermisosUseCase([
          { modulo: 'auth', nombre: 'Usuarios', permisos: { 'ventas.factura.ver': 'x' } },
        ]),
    ).toThrow('Catálogo de permisos inválido');
  });
});
