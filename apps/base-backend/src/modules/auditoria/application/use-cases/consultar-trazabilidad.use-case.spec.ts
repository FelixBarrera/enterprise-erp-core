import type { Actor } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../testing/auditoria-en-memoria.js';
import type { ConsultaTrazabilidad } from '../ports/in/consultar-trazabilidad.port.js';
import type {
  BusquedaUltimoEvento,
  EventosAuditoriaRepositoryPort,
  UltimoEvento,
} from '../ports/out/eventos-auditoria.repository.port.js';
import { ConsultarTrazabilidadUseCase } from './consultar-trazabilidad.use-case.js';

const E1 = '0190a4f2-1c2b-7000-8000-000000000001';
const E2 = '0190a4f2-1c2b-7000-8000-000000000002';
const ROL = '0190a4f2-1c2b-7000-8000-000000000201';
const OTRO = '0190a4f2-1c2b-7000-8000-000000000202';

const CONSULTA: ConsultaTrazabilidad = {
  empresaId: E1,
  entidad: 'rol',
  entidadId: ROL,
  accionesAlta: ['auth.rol.crear'],
  accionesCambio: ['auth.rol.editar', 'auth.rol.permisos'],
};

const ALTA: UltimoEvento = {
  id: 'a',
  ocurridoEn: new Date('2026-07-01T15:00:00Z'),
  nombreUsuario: 'ana',
};
const CAMBIO: UltimoEvento = {
  id: 'b',
  ocurridoEn: new Date('2026-07-10T15:00:00Z'),
  nombreUsuario: 'beto',
};

/** Un repositorio que responde según las acciones pedidas: la primera lectura es la del alta. */
function conEventos(alta: UltimoEvento | null, ultimo: UltimoEvento | null) {
  const ultimoDe = vi.fn<EventosAuditoriaRepositoryPort['ultimoDe']>(
    (busqueda: BusquedaUltimoEvento) =>
      Promise.resolve(busqueda.acciones.length === 1 ? alta : ultimo),
  );
  const repositorio: EventosAuditoriaRepositoryPort = {
    guardar: vi.fn(),
    listar: vi.fn(),
    usuariosDe: vi.fn(),
    buscarPorId: vi.fn(),
    ultimoDe,
  };
  return { casoDeUso: new ConsultarTrazabilidadUseCase(repositorio), ultimoDe };
}

describe('ConsultarTrazabilidadUseCase', () => {
  it('pide la última alta y el último de todos, del registro en la empresa', async () => {
    const { casoDeUso, ultimoDe } = conEventos(ALTA, CAMBIO);
    await casoDeUso.de(CONSULTA);
    const registro = { empresaId: E1, entidad: 'rol', entidadId: ROL };
    expect(ultimoDe).toHaveBeenCalledWith({ ...registro, acciones: ['auth.rol.crear'] });
    expect(ultimoDe).toHaveBeenCalledWith({
      ...registro,
      acciones: ['auth.rol.crear', 'auth.rol.editar', 'auth.rol.permisos'],
    });
  });

  it('con alta y un cambio después: los dos, con quién los hizo', async () => {
    const { casoDeUso } = conEventos(ALTA, CAMBIO);
    expect(await casoDeUso.de(CONSULTA)).toEqual({
      creado: { en: ALTA.ocurridoEn, por: 'ana' },
      modificado: { en: CAMBIO.ocurridoEn, por: 'beto' },
    });
  });

  it('si lo último es la misma alta, no hubo cambios después', async () => {
    const { casoDeUso } = conEventos(ALTA, ALTA);
    expect(await casoDeUso.de(CONSULTA)).toEqual({
      creado: { en: ALTA.ocurridoEn, por: 'ana' },
      modificado: null,
    });
  });

  it('sin alta en la bitácora (registro anterior a ella), solo el cambio', async () => {
    const { casoDeUso } = conEventos(null, CAMBIO);
    expect(await casoDeUso.de(CONSULTA)).toEqual({
      creado: null,
      modificado: { en: CAMBIO.ocurridoEn, por: 'beto' },
    });
  });

  it('sin eventos: ninguno de los dos', async () => {
    const { casoDeUso } = conEventos(null, null);
    expect(await casoDeUso.de(CONSULTA)).toEqual({ creado: null, modificado: null });
  });
});

describe('AuditoriaEnMemoria como trazabilidad', () => {
  const actor = (nombreUsuario: string | null, empresaId = E1): Actor => ({
    usuarioId: nombreUsuario === null ? null : ROL,
    nombreUsuario,
    empresaId,
    ip: null,
    navegador: null,
    requestId: null,
  });

  it('solo cuenta las acciones pedidas, de ese registro y de esa empresa', async () => {
    const auditoria = new AuditoriaEnMemoria(new RelojFijo('2026-07-15T11:00:00-05:00'));
    const evento = (accion: string, entidadId = ROL) => ({
      accion,
      entidad: 'rol',
      entidadId,
      despues: { nombre: accion },
    });
    await auditoria.registrar(evento('auth.rol.crear'), actor('ana'));
    await auditoria.registrar(evento('auth.rol.editar'), actor('beto'));
    await auditoria.registrar(evento('auth.rol.editar'), actor('zoe', E2));
    await auditoria.registrar(evento('auth.rol.editar', OTRO), actor('zoe'));
    await auditoria.registrar(evento('auth.rol.desactivar'), actor(null));

    const traza = await auditoria.de(CONSULTA);
    expect(traza.creado?.por).toBe('ana');
    expect(traza.modificado?.por).toBe('beto');
  });
});
