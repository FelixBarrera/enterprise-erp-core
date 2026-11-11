import { Injector } from '@angular/core';
import { ROLES_REMOTOS_PORT } from '../ports/out/roles-remotos.port';
import { catalogoDePrueba, rolDePrueba, rolResumenDePrueba } from '../testing/roles-de-prueba';
import { ConsultarRolesUseCase } from './consultar-roles.use-case';

function montar() {
  const pagina = { elementos: [rolResumenDePrueba()], total: 1, pagina: 1, tamano: 20 };
  const remotos = {
    listar: vi.fn(() => Promise.resolve(pagina)),
    ver: vi.fn(() => Promise.resolve(rolDePrueba())),
    catalogo: vi.fn(() => Promise.resolve(catalogoDePrueba())),
  };
  const injector = Injector.create({
    providers: [ConsultarRolesUseCase, { provide: ROLES_REMOTOS_PORT, useValue: remotos }],
  });
  return { casoDeUso: injector.get(ConsultarRolesUseCase), remotos, pagina };
}

describe('ConsultarRolesUseCase', () => {
  it('listar: pide la página con los filtros', async () => {
    const { casoDeUso, remotos, pagina } = montar();
    const filtros = { texto: 'caja', estado: 'activos' as const };
    expect(await casoDeUso.listar(filtros, { pagina: 2, tamano: 50 })).toBe(pagina);
    expect(remotos.listar).toHaveBeenCalledWith(filtros, { pagina: 2, tamano: 50 });
  });

  it('ver: la ficha del rol', async () => {
    const { casoDeUso, remotos } = montar();
    expect(await casoDeUso.ver('r-1')).toEqual(rolDePrueba());
    expect(remotos.ver).toHaveBeenCalledWith('r-1');
  });

  it('catalogo: los permisos por grupo', async () => {
    const { casoDeUso, remotos } = montar();
    expect(await casoDeUso.catalogo()).toEqual(catalogoDePrueba());
    expect(remotos.catalogo).toHaveBeenCalledOnce();
  });
});
