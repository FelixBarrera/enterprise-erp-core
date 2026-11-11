import { Injector } from '@angular/core';
import { USUARIOS_REMOTOS_PORT } from '../ports/out/usuarios-remotos.port';
import {
  rolesAsignablesDePrueba,
  usuarioDePrueba,
  usuarioResumenDePrueba,
} from '../testing/usuarios-de-prueba';
import { ConsultarUsuariosUseCase } from './consultar-usuarios.use-case';

describe('ConsultarUsuariosUseCase', () => {
  it('pasa la lista, la ficha y los roles que se pueden dar al backend', async () => {
    const pagina = { elementos: [usuarioResumenDePrueba()], total: 1, pagina: 1, tamano: 20 };
    const remotos = {
      listar: vi.fn(() => Promise.resolve(pagina)),
      ver: vi.fn(() => Promise.resolve(usuarioDePrueba())),
      rolesAsignables: vi.fn(() => Promise.resolve(rolesAsignablesDePrueba())),
    };
    const casoDeUso = Injector.create({
      providers: [ConsultarUsuariosUseCase, { provide: USUARIOS_REMOTOS_PORT, useValue: remotos }],
    }).get(ConsultarUsuariosUseCase);
    const filtros = { texto: 'ana', rol: '', estado: 'activos' } as const;
    expect(await casoDeUso.listar(filtros, { pagina: 1, tamano: 20 })).toBe(pagina);
    expect(remotos.listar).toHaveBeenCalledWith(filtros, { pagina: 1, tamano: 20 });
    expect((await casoDeUso.ver('u-1')).nombreUsuario).toBe('jorge.vera');
    expect(remotos.ver).toHaveBeenCalledWith('u-1');
    expect(await casoDeUso.rolesAsignables()).toHaveLength(4);
  });
});
