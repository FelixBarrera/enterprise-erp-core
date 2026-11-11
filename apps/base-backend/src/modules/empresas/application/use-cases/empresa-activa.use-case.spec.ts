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
import { EmpresaActivaUseCase } from './empresa-activa.use-case.js';

const E1 = idDePrueba(1);
const E2 = idDePrueba(2);

describe('EmpresaActivaUseCase', () => {
  const actor: Actor = {
    usuarioId: idDePrueba(99),
    nombreUsuario: 'ana',
    empresaId: E1,
    ip: '10.0.0.1',
    navegador: null,
    requestId: 'req-1',
  };
  let repositorio: EmpresasEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let casoDeUso: EmpresaActivaUseCase;

  beforeEach(() => {
    repositorio = new EmpresasEnMemoria();
    repositorio.agregar(Empresa.reconstruir({ id: E1, nombre: 'Acme', activo: true }));
    repositorio.agregar(Empresa.reconstruir({ id: E2, nombre: 'Zeta', activo: true }));
    auditoria = new AuditoriaEnMemoria();
    casoDeUso = new EmpresaActivaUseCase(repositorio, { ejecutar: (fn) => fn() }, auditoria);
  });

  it('ver: los datos de su empresa activa', async () => {
    expect(await casoDeUso.ver(actor)).toEqual({ id: E1, nombre: 'Acme', activo: true });
  });

  it('ver: sin empresa activa, una que no existe o una desactivada, 404', async () => {
    repositorio.agregar(Empresa.reconstruir({ id: E2, nombre: 'Zeta', activo: false }));
    for (const empresaId of [null, idDePrueba(7), E2]) {
      await expect(casoDeUso.ver({ ...actor, empresaId })).rejects.toThrow(
        EmpresaNoEncontradaError,
      );
    }
  });

  it('editar: cambia el nombre de su empresa activa (limpio), guarda quién y lo registra', async () => {
    const editada = await casoDeUso.editar({ nombre: '  Acme   Andina ' }, actor);
    expect(editada).toEqual({ id: E1, nombre: 'Acme Andina', activo: true });
    expect(repositorio.filas.get(E1)).toMatchObject({ actualizadoPor: idDePrueba(99) });
    expect(repositorio.filas.get(E1)?.empresa.nombre.valor).toBe('Acme Andina');
    expect(repositorio.filas.get(E2)?.empresa.nombre.valor).toBe('Zeta');
    expect(auditoria.eventos).toHaveLength(1);
    expect(auditoria.eventos[0]).toMatchObject({
      accion: 'empresas.empresa.editar',
      empresaId: E1,
      usuarioId: idDePrueba(99),
      entidad: 'empresa',
      entidadId: E1,
      antes: { nombre: 'Acme' },
      despues: { nombre: 'Acme Andina' },
    });
  });

  it('cambiar solo mayúsculas también es un cambio', async () => {
    expect((await casoDeUso.editar({ nombre: 'ACME' }, actor)).nombre).toBe('ACME');
    expect(auditoria.eventos).toHaveLength(1);
  });

  it.each([{}, { nombre: ' Acme ' }])(
    'sin cambios (%o): responde la empresa, no escribe ni registra',
    async (comando) => {
      expect(await casoDeUso.editar(comando, actor)).toEqual({
        id: E1,
        nombre: 'Acme',
        activo: true,
      });
      expect(repositorio.filas.get(E1)?.actualizadoPor).toBeNull();
      expect(auditoria.eventos).toHaveLength(0);
    },
  );

  it('un nombre vacío o largo: el error del nombre, sin tocar nada', async () => {
    await expect(casoDeUso.editar({ nombre: '   ' }, actor)).rejects.toThrow(
      new NombreEmpresaInvalidoError('El nombre de la empresa es obligatorio'),
    );
    await expect(casoDeUso.editar({ nombre: 'x'.repeat(151) }, actor)).rejects.toThrow(
      NombreEmpresaInvalidoError,
    );
    expect(auditoria.eventos).toHaveLength(0);
  });

  it('el nombre de otra empresa activa (sin importar tildes ni mayúsculas): 409', async () => {
    await expect(casoDeUso.editar({ nombre: 'ZÉTA' }, actor)).rejects.toThrow(
      NombreEmpresaDuplicadoError,
    );
    expect(auditoria.eventos).toHaveLength(0);
  });

  it('sin empresa activa, o una que no existe: 404', async () => {
    await expect(casoDeUso.editar({ nombre: 'X' }, { ...actor, empresaId: null })).rejects.toThrow(
      EmpresaNoEncontradaError,
    );
    await expect(
      casoDeUso.editar({ nombre: 'X' }, { ...actor, empresaId: idDePrueba(7) }),
    ).rejects.toThrow(EmpresaNoEncontradaError);
  });

  it('una empresa desactivada no se edita', async () => {
    repositorio.agregar(Empresa.reconstruir({ id: E1, nombre: 'Acme', activo: false }));
    await expect(casoDeUso.editar({ nombre: 'Otra' }, actor)).rejects.toThrow(EmpresaInactivaError);
  });
});
