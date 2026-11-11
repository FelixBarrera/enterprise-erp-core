import { Injector } from '@angular/core';
import { RolesSinGuardarError } from '../../domain/errors/roles-sin-guardar.error';
import { USUARIOS_REMOTOS_PORT } from '../ports/out/usuarios-remotos.port';
import { usuarioDePrueba } from '../testing/usuarios-de-prueba';
import { AdministrarUsuariosUseCase } from './administrar-usuarios.use-case';

function montar() {
  const remotos = {
    editar: vi.fn(() => Promise.resolve(usuarioDePrueba({ nombreCompleto: 'Jorge Vera Ruiz' }))),
    fijarRoles: vi.fn((_id: string, roles: readonly string[]) =>
      Promise.resolve(
        usuarioDePrueba({
          nombreCompleto: 'Jorge Vera Ruiz',
          roles: roles.map((id) => ({ id, nombre: id, esAdministrador: false, activo: true })),
        }),
      ),
    ),
    quitarAcceso: vi.fn(() => Promise.resolve({ id: 'u-1', sesionesCerradas: 2 })),
    crear: vi.fn(() =>
      Promise.resolve({ usuario: usuarioDePrueba(), contrasenaTemporal: 'k7Rm3xTq9vWb' }),
    ),
    darContrasenaTemporal: vi.fn(() =>
      Promise.resolve({ usuario: usuarioDePrueba(), contrasenaTemporal: 'p4Hn8sLw2cXe' }),
    ),
    desbloquear: vi.fn(() => Promise.resolve(usuarioDePrueba())),
    cerrarSesiones: vi.fn(() => Promise.resolve({ id: 'u-1', sesionesCerradas: 3 })),
    desactivar: vi.fn(() => Promise.resolve(usuarioDePrueba({ activo: false }))),
    reactivar: vi.fn(() => Promise.resolve(usuarioDePrueba())),
  };
  const injector = Injector.create({
    providers: [AdministrarUsuariosUseCase, { provide: USUARIOS_REMOTOS_PORT, useValue: remotos }],
  });
  return { casoDeUso: injector.get(AdministrarUsuariosUseCase), remotos };
}

describe('AdministrarUsuariosUseCase', () => {
  // roles: ['r-soporte']
  const usuario = usuarioDePrueba();

  describe('guardar', () => {
    it('sin cambios: no llama al backend', async () => {
      const { casoDeUso, remotos } = montar();
      expect(await casoDeUso.guardar(usuario, ' Jorge Vera ', ['r-soporte'])).toBeNull();
      expect(remotos.editar).not.toHaveBeenCalled();
      expect(remotos.fijarRoles).not.toHaveBeenCalled();
    });

    it('solo el nombre: PATCH, sin tocar los roles', async () => {
      const { casoDeUso, remotos } = montar();
      const guardado = await casoDeUso.guardar(usuario, 'Jorge Vera Ruiz', ['r-soporte']);
      expect(guardado?.nombreCompleto).toBe('Jorge Vera Ruiz');
      expect(remotos.editar).toHaveBeenCalledWith('u-1', { nombreCompleto: 'Jorge Vera Ruiz' });
      expect(remotos.fijarRoles).not.toHaveBeenCalled();
    });

    it('solo los roles: PUT con la lista completa, sin PATCH', async () => {
      const { casoDeUso, remotos } = montar();
      await casoDeUso.guardar(usuario, 'Jorge Vera', ['r-soporte', 'r-consulta']);
      expect(remotos.editar).not.toHaveBeenCalled();
      expect(remotos.fijarRoles).toHaveBeenCalledWith('u-1', ['r-soporte', 'r-consulta']);
    });

    it('los dos: primero el nombre y luego los roles', async () => {
      const { casoDeUso, remotos } = montar();
      const guardado = await casoDeUso.guardar(usuario, 'Jorge Vera Ruiz', ['r-consulta']);
      expect(remotos.editar.mock.invocationCallOrder[0]).toBeLessThan(
        remotos.fijarRoles.mock.invocationCallOrder[0],
      );
      expect(guardado?.roles.map((r) => r.id)).toEqual(['r-consulta']);
    });

    it('si fallan los roles después del nombre: RolesSinGuardarError con el usuario como quedó', async () => {
      const { casoDeUso, remotos } = montar();
      const causa = new Error('No puede dar permisos que usted no tiene');
      remotos.fijarRoles.mockRejectedValueOnce(causa);
      const error: unknown = await casoDeUso
        .guardar(usuario, 'Jorge Vera Ruiz', ['r-consulta'])
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RolesSinGuardarError);
      expect((error as RolesSinGuardarError).usuario.nombreCompleto).toBe('Jorge Vera Ruiz');
      expect((error as RolesSinGuardarError).causa).toBe(causa);
      expect((error as RolesSinGuardarError).message).toBe(causa.message);
    });

    it('si fallan los roles solos: el error tal cual', async () => {
      const { casoDeUso, remotos } = montar();
      const causa = new Error('La empresa no puede quedarse sin administrador');
      remotos.fijarRoles.mockRejectedValueOnce(causa);
      await expect(casoDeUso.guardar(usuario, 'Jorge Vera', ['r-consulta'])).rejects.toBe(causa);
    });
  });

  it('quitarAcceso: lo pide al backend', async () => {
    const { casoDeUso, remotos } = montar();
    expect(await casoDeUso.quitarAcceso('u-1')).toEqual({ id: 'u-1', sesionesCerradas: 2 });
    expect(remotos.quitarAcceso).toHaveBeenCalledWith('u-1');
  });

  it('crear: el nombre de usuario en minúsculas y sin espacios; el nombre, recortado', async () => {
    const { casoDeUso, remotos } = montar();
    const creado = await casoDeUso.crear({
      nombreUsuario: ' Lucia.Torres ',
      nombreCompleto: ' Lucía Torres ',
      roles: ['r-consulta'],
    });
    expect(remotos.crear).toHaveBeenCalledWith({
      nombreUsuario: 'lucia.torres',
      nombreCompleto: 'Lucía Torres',
      roles: ['r-consulta'],
    });
    expect(creado.contrasenaTemporal).toBe('k7Rm3xTq9vWb');
  });

  describe('acciones sobre la persona', () => {
    it('cada una va a su endpoint con el id y devuelve lo que responde', async () => {
      const { casoDeUso, remotos } = montar();
      expect((await casoDeUso.darContrasenaTemporal('u-1')).contrasenaTemporal).toBe(
        'p4Hn8sLw2cXe',
      );
      expect(remotos.darContrasenaTemporal).toHaveBeenCalledWith('u-1');
      await casoDeUso.desbloquear('u-1');
      expect(remotos.desbloquear).toHaveBeenCalledWith('u-1');
      expect((await casoDeUso.cerrarSesiones('u-1')).sesionesCerradas).toBe(3);
      expect(remotos.cerrarSesiones).toHaveBeenCalledWith('u-1');
      expect((await casoDeUso.desactivar('u-1')).activo).toBe(false);
      expect(remotos.desactivar).toHaveBeenCalledWith('u-1');
      await casoDeUso.reactivar('u-1');
      expect(remotos.reactivar).toHaveBeenCalledWith('u-1');
    });
  });
});
