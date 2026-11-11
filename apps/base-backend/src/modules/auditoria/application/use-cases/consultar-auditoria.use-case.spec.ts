import { actorDelSistema } from '../../../../shared/application/actor.js';
import { FechaInvalidaError } from '../../../../shared/domain/errors/valores.errors.js';
import {
  EventoNoEncontradoError,
  RangoFechasInvalidoError,
} from '../../domain/errors/auditoria.errors.js';
import type {
  EventoAuditoriaGuardado,
  EventosAuditoriaRepositoryPort,
} from '../ports/out/eventos-auditoria.repository.port.js';
import { ConsultarAuditoriaUseCase } from './consultar-auditoria.use-case.js';

const EMPRESA = '0190a4f2-1c2b-7000-8000-000000000001';
const actor = actorDelSistema({ empresaId: EMPRESA });
const pedido = { pagina: 2, tamano: 5 };

const guardado: EventoAuditoriaGuardado = {
  id: 'ev1',
  ocurridoEn: new Date('2026-11-06T16:30:00Z'),
  empresaId: EMPRESA,
  usuarioId: 'u1',
  nombreUsuario: 'ana',
  accion: 'auth.usuario.editar',
  entidad: 'usuario',
  entidadId: 'u2',
  entidadNombre: 'beto',
  antes: { nombreCompleto: 'Ana' },
  despues: { nombreCompleto: 'Ana Ruiz' },
  ip: '192.0.2.10',
  navegador: 'Prueba',
  requestId: 'r1',
};

function crear() {
  const eventos = {
    guardar: vi.fn<EventosAuditoriaRepositoryPort['guardar']>(),
    ultimoDe: vi.fn<EventosAuditoriaRepositoryPort['ultimoDe']>(),
    listar: vi.fn<EventosAuditoriaRepositoryPort['listar']>(() =>
      Promise.resolve({ elementos: [guardado], total: 11 }),
    ),
    buscarPorId: vi.fn<EventosAuditoriaRepositoryPort['buscarPorId']>(() =>
      Promise.resolve(guardado),
    ),
    usuariosDe: vi.fn<EventosAuditoriaRepositoryPort['usuariosDe']>(() =>
      Promise.resolve([{ usuarioId: 'u1', nombreUsuario: 'ana' }]),
    ),
  };
  return { eventos, casoDeUso: new ConsultarAuditoriaUseCase(eventos) };
}

describe('ConsultarAuditoriaUseCase', () => {
  describe('listar', () => {
    it('busca en la empresa activa, del inicio de desde a antes del día siguiente a hasta', async () => {
      const { eventos, casoDeUso } = crear();
      const pagina = await casoDeUso.listar(
        { desde: '2026-11-01', hasta: '2026-11-06', accion: 'auth.usuario', usuarioId: 'u1' },
        pedido,
        actor,
      );
      expect(eventos.listar).toHaveBeenCalledWith(
        EMPRESA,
        {
          desde: new Date('2026-11-01T05:00:00Z'),
          hastaAntesDe: new Date('2026-11-07T05:00:00Z'),
          usuarioId: 'u1',
          accion: 'auth.usuario',
          entidad: undefined,
          entidadId: undefined,
        },
        pedido,
      );
      expect(pagina).toEqual({
        total: 11,
        pagina: 2,
        tamano: 5,
        elementos: [
          {
            id: 'ev1',
            ocurridoEn: guardado.ocurridoEn,
            usuarioId: 'u1',
            nombreUsuario: 'ana',
            accion: 'auth.usuario.editar',
            entidad: 'usuario',
            entidadId: 'u2',
            entidadNombre: 'beto',
          },
        ],
      });
    });

    it('la historia de un registro (6.12c0b): sin fechas ni tope de días', async () => {
      const { eventos, casoDeUso } = crear();
      const registro = { entidad: 'usuario', entidadId: 'u2' };
      await casoDeUso.listar(registro, pedido, actor);
      expect(eventos.listar).toHaveBeenLastCalledWith(
        EMPRESA,
        expect.objectContaining({ desde: undefined, hastaAntesDe: undefined, ...registro }),
        pedido,
      );
      await casoDeUso.listar(
        { ...registro, desde: '2020-01-01', hasta: '2026-11-06' },
        pedido,
        actor,
      );
      expect(eventos.listar).toHaveBeenLastCalledWith(
        EMPRESA,
        expect.objectContaining({
          desde: new Date('2020-01-01T05:00:00Z'),
          hastaAntesDe: new Date('2026-11-07T05:00:00Z'),
        }),
        pedido,
      );
      await expect(
        casoDeUso.listar({ ...registro, desde: '2026-11-06', hasta: '2026-11-01' }, pedido, actor),
      ).rejects.toThrow(RangoFechasInvalidoError);
    });

    it('fuera de la historia, sin una de las fechas: 400 (también solo con el tipo)', async () => {
      const { eventos, casoDeUso } = crear();
      const mensaje =
        'Las fechas desde y hasta son obligatorias, salvo en la historia de un registro';
      await expect(casoDeUso.listar({ desde: '2026-11-01' }, pedido, actor)).rejects.toThrow(
        mensaje,
      );
      await expect(casoDeUso.listar({ entidad: 'usuario' }, pedido, actor)).rejects.toThrow(
        mensaje,
      );
      expect(eventos.listar).not.toHaveBeenCalled();
    });

    it('rechaza el rango al revés, el de más de 92 días y una fecha que no existe', async () => {
      const { eventos, casoDeUso } = crear();
      await expect(
        casoDeUso.listar({ desde: '2026-11-06', hasta: '2026-11-01' }, pedido, actor),
      ).rejects.toThrow(RangoFechasInvalidoError);
      await expect(
        casoDeUso.listar({ desde: '2026-01-01', hasta: '2026-04-03' }, pedido, actor),
      ).rejects.toThrow('El rango no puede pasar de 92 días');
      await expect(
        casoDeUso.listar({ desde: '2026-02-30', hasta: '2026-03-01' }, pedido, actor),
      ).rejects.toThrow(FechaInvalidaError);
      expect(eventos.listar).not.toHaveBeenCalled();
    });

    it('sin empresa activa, nada (los eventos sin empresa no se ven, AUD-D5)', async () => {
      const { eventos, casoDeUso } = crear();
      const pagina = await casoDeUso.listar(
        { desde: '2026-11-01', hasta: '2026-11-06' },
        pedido,
        actorDelSistema({}),
      );
      expect(pagina).toEqual({ elementos: [], total: 0, pagina: 2, tamano: 5 });
      expect(eventos.listar).not.toHaveBeenCalled();
    });
  });

  describe('usuarios', () => {
    it('los de la bitácora de la empresa activa', async () => {
      const { eventos, casoDeUso } = crear();
      expect(await casoDeUso.usuarios(actor)).toEqual([{ usuarioId: 'u1', nombreUsuario: 'ana' }]);
      expect(eventos.usuariosDe).toHaveBeenCalledWith(EMPRESA);
    });

    it('sin empresa activa, ninguno y sin consultar (AUD-D5)', async () => {
      const { eventos, casoDeUso } = crear();
      expect(await casoDeUso.usuarios(actorDelSistema())).toEqual([]);
      expect(eventos.usuariosDe).not.toHaveBeenCalled();
    });
  });

  describe('ver', () => {
    it('el evento completo de la empresa activa', async () => {
      const { eventos, casoDeUso } = crear();
      const { empresaId: _empresa, ...esperado } = guardado;
      expect(await casoDeUso.ver('ev1', actor)).toEqual(esperado);
      expect(eventos.buscarPorId).toHaveBeenCalledWith('ev1', EMPRESA);
    });

    it('no existe o es de otra empresa: 404', async () => {
      const { eventos, casoDeUso } = crear();
      eventos.buscarPorId.mockResolvedValue(null);
      await expect(casoDeUso.ver('ev1', actor)).rejects.toThrow(EventoNoEncontradoError);
    });

    it('sin empresa activa: 404 sin buscar', async () => {
      const { eventos, casoDeUso } = crear();
      await expect(casoDeUso.ver('ev1', actorDelSistema({}))).rejects.toThrow(
        EventoNoEncontradoError,
      );
      expect(eventos.buscarPorId).not.toHaveBeenCalled();
    });
  });
});
