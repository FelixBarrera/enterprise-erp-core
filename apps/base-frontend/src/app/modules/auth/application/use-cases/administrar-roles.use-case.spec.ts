import { Injector } from '@angular/core';
import { PermisosSinGuardarError } from '../../domain/errors/permisos-sin-guardar.error';
import { ROLES_REMOTOS_PORT } from '../ports/out/roles-remotos.port';
import { rolDePrueba } from '../testing/roles-de-prueba';
import { AdministrarRolesUseCase } from './administrar-roles.use-case';

function montar() {
  const remotos = {
    crear: vi.fn(() => Promise.resolve(rolDePrueba({ id: 'r-2', nombre: 'Caja' }))),
    editar: vi.fn(() => Promise.resolve(rolDePrueba({ nombre: 'Tesorería' }))),
    fijarPermisos: vi.fn((_id: string, permisos: readonly string[]) =>
      Promise.resolve(rolDePrueba({ nombre: 'Tesorería', permisos: [...permisos] })),
    ),
    desactivar: vi.fn(() => Promise.resolve(rolDePrueba({ activo: false }))),
    reactivar: vi.fn(() => Promise.resolve(rolDePrueba())),
  };
  const injector = Injector.create({
    providers: [AdministrarRolesUseCase, { provide: ROLES_REMOTOS_PORT, useValue: remotos }],
  });
  return { casoDeUso: injector.get(AdministrarRolesUseCase), remotos };
}

describe('AdministrarRolesUseCase', () => {
  // permisos: ['auth.usuario.ver']
  const rol = rolDePrueba();
  const mismosDatos = { nombre: rol.nombre, descripcion: rol.descripcion ?? '' };

  describe('guardar', () => {
    it('solo datos: PATCH con lo que cambió, sin tocar los permisos', async () => {
      const { casoDeUso, remotos } = montar();
      const guardado = await casoDeUso.guardar(rol, { ...mismosDatos, nombre: 'Tesorería' }, [
        'auth.usuario.ver',
      ]);
      expect(guardado?.nombre).toBe('Tesorería');
      expect(remotos.editar).toHaveBeenCalledWith('r-1', { nombre: 'Tesorería' });
      expect(remotos.fijarPermisos).not.toHaveBeenCalled();
    });

    it('solo permisos: PUT con la lista completa, sin PATCH', async () => {
      const { casoDeUso, remotos } = montar();
      const guardado = await casoDeUso.guardar(rol, mismosDatos, [
        'auth.usuario.ver',
        'auth.rol.ver',
      ]);
      expect(remotos.editar).not.toHaveBeenCalled();
      expect(remotos.fijarPermisos).toHaveBeenCalledWith('r-1', [
        'auth.usuario.ver',
        'auth.rol.ver',
      ]);
      expect(guardado?.permisos).toEqual(['auth.usuario.ver', 'auth.rol.ver']);
    });

    it('los dos: primero los datos y luego los permisos', async () => {
      const { casoDeUso, remotos } = montar();
      const orden: string[] = [];
      remotos.editar.mockImplementationOnce(() => {
        orden.push('editar');
        return Promise.resolve(rolDePrueba({ nombre: 'Tesorería' }));
      });
      remotos.fijarPermisos.mockImplementationOnce(() => {
        orden.push('permisos');
        return Promise.resolve(rolDePrueba({ nombre: 'Tesorería', permisos: [] }));
      });
      const guardado = await casoDeUso.guardar(rol, { ...mismosDatos, nombre: 'Tesorería' }, []);
      expect(orden).toEqual(['editar', 'permisos']);
      expect(guardado).toMatchObject({ nombre: 'Tesorería', permisos: [] });
    });

    it('sin cambios (el orden de los permisos no cuenta): no llama al backend', async () => {
      const { casoDeUso, remotos } = montar();
      const conDos = rolDePrueba({ permisos: ['a.b.c', 'd.e.f'] });
      expect(await casoDeUso.guardar(conDos, mismosDatos, ['d.e.f', 'a.b.c'])).toBeNull();
      expect(remotos.editar).not.toHaveBeenCalled();
      expect(remotos.fijarPermisos).not.toHaveBeenCalled();
    });

    it('datos rechazados: lanza su error y no manda los permisos', async () => {
      const { casoDeUso, remotos } = montar();
      const error = new Error('Ya existe un rol con ese nombre');
      remotos.editar.mockRejectedValueOnce(error);
      await expect(casoDeUso.guardar(rol, { nombre: 'Otro', descripcion: '' }, [])).rejects.toBe(
        error,
      );
      expect(remotos.fijarPermisos).not.toHaveBeenCalled();
    });

    it('solo permisos y rechazados: lanza su error tal cual', async () => {
      const { casoDeUso, remotos } = montar();
      const error = new Error('No puede dar permisos que usted no tiene');
      remotos.fijarPermisos.mockRejectedValueOnce(error);
      await expect(casoDeUso.guardar(rol, mismosDatos, [])).rejects.toBe(error);
    });

    it('datos guardados y permisos rechazados: PermisosSinGuardarError con el rol como quedó', async () => {
      const { casoDeUso, remotos } = montar();
      const causa = new Error('No puede dar permisos que usted no tiene');
      remotos.fijarPermisos.mockRejectedValueOnce(causa);
      const error: unknown = await casoDeUso
        .guardar(rol, { ...mismosDatos, nombre: 'Tesorería' }, ['auth.rol.ver'])
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PermisosSinGuardarError);
      const parcial = error as PermisosSinGuardarError;
      expect(parcial.rol.nombre).toBe('Tesorería');
      expect(parcial.causa).toBe(causa);
      expect(parcial.message).toBe('No puede dar permisos que usted no tiene');
    });
  });

  it('crear: POST con los datos, sin descripción si está vacía, y los permisos', async () => {
    const { casoDeUso, remotos } = montar();
    const rolCreado = await casoDeUso.crear({ nombre: 'Caja', descripcion: '  ' }, [
      'auth.rol.ver',
    ]);
    expect(rolCreado.id).toBe('r-2');
    expect(remotos.crear).toHaveBeenCalledWith({
      nombre: 'Caja',
      descripcion: null,
      permisos: ['auth.rol.ver'],
    });
  });

  it('desactivar y reactivar', async () => {
    const { casoDeUso, remotos } = montar();
    expect((await casoDeUso.desactivar('r-1')).activo).toBe(false);
    expect((await casoDeUso.reactivar('r-1')).activo).toBe(true);
    expect(remotos.desactivar).toHaveBeenCalledWith('r-1');
    expect(remotos.reactivar).toHaveBeenCalledWith('r-1');
  });
});
