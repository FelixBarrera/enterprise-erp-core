import { actorDelSistema } from './actor.js';

describe('actorDelSistema', () => {
  it('sin datos: todo en null (usuarioId null = el sistema)', () => {
    expect(actorDelSistema()).toEqual({
      usuarioId: null,
      nombreUsuario: null,
      empresaId: null,
      ip: null,
      navegador: null,
      requestId: null,
    });
  });

  it('con la empresa y un nombre para la bitácora', () => {
    const actor = actorDelSistema({
      empresaId: '0190a4f2-0000-7000-8000-000000000001',
      nombreUsuario: 'comando',
    });
    expect(actor).toMatchObject({ usuarioId: null, nombreUsuario: 'comando' });
    expect(actor.empresaId).toBe('0190a4f2-0000-7000-8000-000000000001');
  });
});
