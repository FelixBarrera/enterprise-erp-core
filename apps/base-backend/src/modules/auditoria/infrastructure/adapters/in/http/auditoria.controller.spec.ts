import { actorDelSistema } from '../../../../../../shared/application/actor.js';
import type {
  ConsultarAuditoriaPort,
  EventoVista,
} from '../../../../application/ports/in/consultar-auditoria.port.js';
import { AuditoriaController } from './auditoria.controller.js';
import { ListarEventosQueryDto } from './dtos/listar-eventos-query.dto.js';

describe('AuditoriaController', () => {
  const actor = actorDelSistema({ empresaId: 'e1' });
  const evento = { id: 'ev1' } as EventoVista;
  const pagina = { elementos: [], total: 0, pagina: 2, tamano: 5 };
  const consultar = {
    listar: vi.fn<ConsultarAuditoriaPort['listar']>(() => Promise.resolve(pagina)),
    ver: vi.fn<ConsultarAuditoriaPort['ver']>(() => Promise.resolve(evento)),
    usuarios: vi.fn<ConsultarAuditoriaPort['usuarios']>(() =>
      Promise.resolve([{ usuarioId: 'u1', nombreUsuario: 'ana' }]),
    ),
  };
  const controller = new AuditoriaController(consultar);

  it('listar: pasa los filtros y la página, sin mezclarlos', async () => {
    const query = Object.assign(new ListarEventosQueryDto(), {
      pagina: 2,
      tamano: 5,
      desde: '2026-11-01',
      hasta: '2026-11-06',
      accion: 'auth',
      entidad: 'usuario',
      entidadId: 'u2',
    });
    expect(await controller.listar(query, actor)).toEqual({
      success: true,
      data: pagina,
      message: 'Bitácora',
    });
    expect(consultar.listar).toHaveBeenCalledWith(
      {
        desde: '2026-11-01',
        hasta: '2026-11-06',
        usuarioId: undefined,
        accion: 'auth',
        entidad: 'usuario',
        entidadId: 'u2',
      },
      { pagina: 2, tamano: 5 },
      actor,
    );
  });

  it('usuarios', async () => {
    expect(await controller.usuarios(actor)).toEqual({
      success: true,
      data: [{ usuarioId: 'u1', nombreUsuario: 'ana' }],
      message: 'Usuarios de la bitácora',
    });
    expect(consultar.usuarios).toHaveBeenCalledWith(actor);
  });

  it('ver', async () => {
    expect(await controller.ver('ev1', actor)).toEqual({
      success: true,
      data: evento,
      message: 'Datos del evento',
    });
    expect(consultar.ver).toHaveBeenCalledWith('ev1', actor);
  });
});
