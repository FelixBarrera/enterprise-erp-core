import type { Actor } from '../../../../shared/application/actor.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import { Empresa } from '../../domain/entities/empresa.entity.js';
import {
  EmpresaInactivaError,
  EmpresaNoEncontradaError,
  NombreEmpresaDuplicadoError,
  NombreEmpresaInvalidoError,
} from '../../domain/errors/empresas.errors.js';
import { EmpresasEnMemoria, idDePrueba } from '../testing/empresas-en-memoria.js';
import { RenombrarEmpresaUseCase } from './renombrar-empresa.use-case.js';

const E1 = idDePrueba(1);
const E2 = idDePrueba(2);
const E3 = idDePrueba(3);

describe('RenombrarEmpresaUseCase', () => {
  // Como el actor de un comando: sin usuario ni empresa.
  const actor: Actor = {
    usuarioId: null,
    nombreUsuario: 'admin:renombrar-empresa',
    empresaId: null,
    ip: null,
    navegador: null,
    requestId: null,
  };
  let repositorio: EmpresasEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let casoDeUso: RenombrarEmpresaUseCase;

  beforeEach(() => {
    repositorio = new EmpresasEnMemoria();
    repositorio.agregar(Empresa.reconstruir({ id: E1, nombre: 'Acme', activo: true }));
    repositorio.agregar(Empresa.reconstruir({ id: E2, nombre: 'Café Ríos', activo: true }));
    repositorio.agregar(Empresa.reconstruir({ id: E3, nombre: 'Vieja', activo: false }));
    auditoria = new AuditoriaEnMemoria();
    casoDeUso = new RenombrarEmpresaUseCase(repositorio, { ejecutar: (fn) => fn() }, auditoria);
  });

  it('la renombra (limpiando los espacios) y registra el cambio en esa empresa', async () => {
    const resultado = await casoDeUso.renombrar(E1, '  Acme   Holding ', actor);
    expect(resultado).toEqual({
      empresa: { id: E1, nombre: 'Acme Holding', activo: true },
      cambio: true,
    });
    expect(repositorio.filas.get(E1)?.empresa.nombre.valor).toBe('Acme Holding');
    expect(auditoria.eventos[0]).toMatchObject({
      accion: 'empresas.empresa.editar',
      empresaId: E1,
      usuarioId: null,
      nombreUsuario: 'admin:renombrar-empresa',
      entidad: 'empresa',
      entidadId: E1,
      entidadNombre: 'Acme Holding',
      antes: { nombre: 'Acme' },
      despues: { nombre: 'Acme Holding' },
    });
  });

  it('con el mismo nombre no escribe ni registra (dos veces no rompe nada)', async () => {
    const resultado = await casoDeUso.renombrar(E1, 'Acme', actor);
    expect(resultado.cambio).toBe(false);
    expect(auditoria.acciones()).toEqual([]);
  });

  it('un nombre vacío no llega a la base', async () => {
    await expect(casoDeUso.renombrar(E1, '   ', actor)).rejects.toThrow(NombreEmpresaInvalidoError);
    expect(repositorio.filas.get(E1)?.empresa.nombre.valor).toBe('Acme');
  });

  it('el nombre de otra empresa activa (sin importar tildes): 409', async () => {
    await expect(casoDeUso.renombrar(E1, 'cafe rios', actor)).rejects.toThrow(
      NombreEmpresaDuplicadoError,
    );
    expect(auditoria.acciones()).toEqual([]);
  });

  it('una desactivada no se renombra', async () => {
    await expect(casoDeUso.renombrar(E3, 'Nueva', actor)).rejects.toThrow(EmpresaInactivaError);
  });

  it('si no existe: 404', async () => {
    await expect(casoDeUso.renombrar(idDePrueba(9), 'Nueva', actor)).rejects.toThrow(
      EmpresaNoEncontradaError,
    );
  });
});
