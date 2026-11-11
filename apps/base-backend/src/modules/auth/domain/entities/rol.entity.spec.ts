import { RolAdministradorFijoError } from '../errors/auth.errors.js';
import { NombreRol } from '../value-objects/nombre-rol.vo.js';
import { type DatosRol, Rol } from './rol.entity.js';

const datos: DatosRol = {
  id: '0190a4f2-1c2b-7000-8000-000000000001',
  empresaId: '0190a4f2-1c2b-7000-8000-000000000009',
  nombre: 'Caja',
  descripcion: 'Cobra en caja',
  esAdministrador: false,
  activo: true,
};

describe('Rol', () => {
  it('reconstruye y devuelve los mismos datos', () => {
    expect(Rol.reconstruir(datos).datos()).toEqual(datos);
  });

  it('un rol común se edita, se desactiva y se reactiva', () => {
    const rol = Rol.reconstruir(datos);
    const editado = rol.editar(NombreRol.crear('Cajero'), null);
    expect(editado.datos()).toMatchObject({ nombre: 'Cajero', descripcion: null });
    expect(rol.desactivar().activo).toBe(false);
    expect(rol.desactivar().reactivar().activo).toBe(true);
    expect(rol.activo).toBe(true);
  });

  it('el Administrador no se edita ni se desactiva', () => {
    const administrador = Rol.reconstruir({
      ...datos,
      nombre: 'Administrador',
      esAdministrador: true,
    });
    expect(() => administrador.desactivar()).toThrow(RolAdministradorFijoError);
    expect(() => administrador.editar(NombreRol.crear('Otro'), null)).toThrow(
      'El rol Administrador no se puede cambiar',
    );
  });
});
