import { actorDelSistema } from '../../../../shared/application/actor.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import {
  NombreEmpresaDuplicadoError,
  NombreEmpresaInvalidoError,
} from '../../domain/errors/empresas.errors.js';
import { EmpresasEnMemoria, idDePrueba } from '../testing/empresas-en-memoria.js';
import { CrearEmpresaUseCase } from './crear-empresa.use-case.js';

const ID = idDePrueba(1);

describe('CrearEmpresaUseCase', () => {
  const actor = actorDelSistema({ nombreUsuario: 'comando' });
  let repositorio: EmpresasEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let casoDeUso: CrearEmpresaUseCase;

  beforeEach(() => {
    repositorio = new EmpresasEnMemoria();
    auditoria = new AuditoriaEnMemoria();
    casoDeUso = new CrearEmpresaUseCase(repositorio, { ejecutar: (fn) => fn() }, auditoria);
  });

  it('crea la empresa activa, con el nombre limpio y quién la creó', async () => {
    const empresa = await casoDeUso.crear({ nombre: '  Comercial  Sur ' }, actor);
    expect(empresa).toEqual({ id: ID, nombre: 'Comercial Sur', activo: true });
    expect(repositorio.filas.get(ID)?.creadoPor).toBeNull();
  });

  it('registra empresas.empresa.crear en la empresa nueva', async () => {
    await casoDeUso.crear({ nombre: 'Acme' }, actor);
    expect(auditoria.acciones()).toEqual(['empresas.empresa.crear']);
    expect(auditoria.eventos[0]).toMatchObject({
      empresaId: ID,
      usuarioId: null,
      nombreUsuario: 'comando',
      entidad: 'empresa',
      entidadId: ID,
      antes: null,
      despues: { nombre: 'Acme', activo: true },
    });
  });

  it('nombre inválido: no crea ni registra', async () => {
    await expect(casoDeUso.crear({ nombre: '  ' }, actor)).rejects.toThrow(
      NombreEmpresaInvalidoError,
    );
    expect(repositorio.filas.size).toBe(0);
    expect(auditoria.acciones()).toEqual([]);
  });

  it('nombre repetido (sin importar mayúsculas ni tildes): 409 y sin evento', async () => {
    await casoDeUso.crear({ nombre: 'Café Ríos' }, actor);
    await expect(casoDeUso.crear({ nombre: 'CAFE RIOS' }, actor)).rejects.toThrow(
      NombreEmpresaDuplicadoError,
    );
    expect(auditoria.acciones()).toEqual(['empresas.empresa.crear']);
  });

  it('todo va en una sola transacción', async () => {
    const ejecutar = vi.fn((fn: () => Promise<unknown>) => fn());
    casoDeUso = new CrearEmpresaUseCase(
      repositorio,
      { ejecutar: ejecutar as <T>(fn: () => Promise<T>) => Promise<T> },
      auditoria,
    );
    await casoDeUso.crear({ nombre: 'Acme' }, actor);
    expect(ejecutar).toHaveBeenCalledTimes(1);
  });
});
