import { actorDelSistema } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import type { EventoAuditoria } from '../../domain/evento-auditoria.js';
import { EventoAuditoriaInvalidoError } from '../../domain/errors/auditoria.errors.js';
import { RegistrarAuditoriaUseCase } from './registrar-auditoria.use-case.js';

describe('RegistrarAuditoriaUseCase', () => {
  const reloj = new RelojFijo('2026-07-15T11:00:00-05:00');
  let guardados: EventoAuditoria[];
  let casoDeUso: RegistrarAuditoriaUseCase;

  beforeEach(() => {
    guardados = [];
    casoDeUso = new RegistrarAuditoriaUseCase(
      { guardar: (evento) => Promise.resolve(void guardados.push(evento)) },
      reloj,
    );
  });

  it('guarda el evento con la hora del reloj', async () => {
    await casoDeUso.registrar(
      { accion: 'auth.usuario.crear', despues: { nombre: 'Ana' } },
      actorDelSistema({ nombreUsuario: 'comando' }),
    );
    expect(guardados).toHaveLength(1);
    expect(guardados[0]?.ocurridoEn).toEqual(new Date('2026-07-15T16:00:00Z'));
    expect(guardados[0]?.nombreUsuario).toBe('comando');
  });

  it('si nada cambió, no escribe', async () => {
    await casoDeUso.registrar(
      { accion: 'auth.usuario.editar', antes: { a: 1 }, despues: { a: 1 } },
      actorDelSistema(),
    );
    expect(guardados).toEqual([]);
  });

  it('un evento mal armado falla y no escribe', async () => {
    await expect(casoDeUso.registrar({ accion: 'mal' }, actorDelSistema())).rejects.toThrow(
      EventoAuditoriaInvalidoError,
    );
    expect(guardados).toEqual([]);
  });
});
