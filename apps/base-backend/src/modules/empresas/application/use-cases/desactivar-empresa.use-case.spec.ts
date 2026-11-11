import type { Actor } from '../../../../shared/application/actor.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import { Empresa } from '../../domain/entities/empresa.entity.js';
import { EmpresaNoEncontradaError } from '../../domain/errors/empresas.errors.js';
import { EmpresasEnMemoria, idDePrueba } from '../testing/empresas-en-memoria.js';
import { DesactivarEmpresaUseCase } from './desactivar-empresa.use-case.js';

const E1 = idDePrueba(1);

describe('DesactivarEmpresaUseCase', () => {
  const actor: Actor = {
    usuarioId: idDePrueba(99),
    nombreUsuario: 'ana',
    empresaId: null,
    ip: null,
    navegador: null,
    requestId: null,
  };
  let repositorio: EmpresasEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let casoDeUso: DesactivarEmpresaUseCase;

  beforeEach(() => {
    repositorio = new EmpresasEnMemoria();
    repositorio.agregar(Empresa.reconstruir({ id: E1, nombre: 'Acme', activo: true }));
    auditoria = new AuditoriaEnMemoria();
    casoDeUso = new DesactivarEmpresaUseCase(repositorio, { ejecutar: (fn) => fn() }, auditoria);
  });

  it('la desactiva, guarda quién y registra el cambio en esa empresa', async () => {
    const resultado = await casoDeUso.desactivar(E1, actor);
    expect(resultado).toEqual({
      empresa: { id: E1, nombre: 'Acme', activo: false },
      yaEstabaDesactivada: false,
    });
    expect(repositorio.filas.get(E1)).toMatchObject({ actualizadoPor: idDePrueba(99) });
    expect(repositorio.filas.get(E1)?.empresa.activo).toBe(false);
    expect(auditoria.eventos[0]).toMatchObject({
      accion: 'empresas.empresa.desactivar',
      empresaId: E1,
      usuarioId: idDePrueba(99),
      entidadId: E1,
      antes: { activo: true },
      despues: { activo: false },
    });
  });

  it('dos veces no rompe nada: la segunda avisa y no registra', async () => {
    await casoDeUso.desactivar(E1, actor);
    const segunda = await casoDeUso.desactivar(E1, actor);
    expect(segunda.yaEstabaDesactivada).toBe(true);
    expect(auditoria.acciones()).toEqual(['empresas.empresa.desactivar']);
  });

  it('si no existe: 404', async () => {
    await expect(casoDeUso.desactivar('x', actor)).rejects.toThrow(EmpresaNoEncontradaError);
    expect(auditoria.acciones()).toEqual([]);
  });
});
