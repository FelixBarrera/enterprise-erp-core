import { Empresa } from '../../domain/entities/empresa.entity.js';
import { EmpresasEnMemoria } from '../testing/empresas-en-memoria.js';
import { ConsultarEmpresasUseCase } from './consultar-empresas.use-case.js';

describe('ConsultarEmpresasUseCase', () => {
  let repositorio: EmpresasEnMemoria;
  let casoDeUso: ConsultarEmpresasUseCase;

  beforeEach(() => {
    repositorio = new EmpresasEnMemoria();
    repositorio.agregar(Empresa.reconstruir({ id: 'a', nombre: 'Zeta', activo: true }));
    repositorio.agregar(Empresa.reconstruir({ id: 'b', nombre: 'Ámbar', activo: false }));
    casoDeUso = new ConsultarEmpresasUseCase(repositorio);
  });

  it('buscarActiva(): la activa sí', async () => {
    expect(await casoDeUso.buscarActiva('a')).toEqual({ id: 'a', nombre: 'Zeta', activo: true });
  });

  it('buscarActiva(): la desactivada o la que no existe, null', async () => {
    expect(await casoDeUso.buscarActiva('b')).toBeNull();
    expect(await casoDeUso.buscarActiva('x')).toBeNull();
  });

  it('nombres(): por nombre, activas o no, sin repetir ni inventar', async () => {
    expect(await casoDeUso.nombres(['a', 'b', 'a', 'x'])).toEqual([
      { id: 'b', nombre: 'Ámbar', activo: false },
      { id: 'a', nombre: 'Zeta', activo: true },
    ]);
  });

  it('nombres() sin ids no consulta', async () => {
    const buscarPorIds = vi.spyOn(repositorio, 'buscarPorIds');
    expect(await casoDeUso.nombres([])).toEqual([]);
    expect(buscarPorIds).not.toHaveBeenCalled();
  });

  it('listarActivas(): solo las activas, por nombre', async () => {
    repositorio.agregar(Empresa.reconstruir({ id: 'c', nombre: 'Beta', activo: true }));
    expect((await casoDeUso.listarActivas()).map(({ nombre }) => nombre)).toEqual(['Beta', 'Zeta']);
  });

  it('hayAlguna()', async () => {
    expect(await casoDeUso.hayAlguna()).toBe(true);
    expect(await new ConsultarEmpresasUseCase(new EmpresasEnMemoria()).hayAlguna()).toBe(false);
  });
});
