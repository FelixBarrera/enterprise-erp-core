import { PermisosController } from './permisos.controller.js';

describe('PermisosController', () => {
  it('responde el catálogo del caso de uso', () => {
    const grupos = [{ modulo: 'auth', nombre: 'Usuarios y roles', permisos: [] }];
    const controller = new PermisosController({ execute: () => grupos });
    expect(controller.listar()).toEqual({
      success: true,
      data: grupos,
      message: 'Catálogo de permisos',
    });
  });
});
