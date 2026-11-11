import { Injector } from '@angular/core';
import type { FiltrosBitacora } from '../../domain/filtros-bitacora';
import { BITACORA_REMOTA_PORT } from '../ports/out/bitacora-remota.port';
import { detalleDePrueba, eventoDePrueba } from '../testing/eventos-de-prueba';
import { ConsultarBitacoraUseCase } from './consultar-bitacora.use-case';

const FILTROS: FiltrosBitacora = {
  desde: '2026-11-01',
  hasta: '2026-11-07',
  usuario: '',
  accion: 'auth.usuario',
  registro: null,
};

function montar() {
  const pagina = { elementos: [eventoDePrueba()], total: 1, pagina: 1, tamano: 20 };
  const remota = {
    listar: vi.fn(() => Promise.resolve(pagina)),
    usuarios: vi.fn(() => Promise.resolve([{ usuarioId: 'u-1', nombreUsuario: 'ana.perez' }])),
    ver: vi.fn((id: string) => Promise.resolve(detalleDePrueba({ id }))),
    descripcionesPermisos: vi.fn(() =>
      Promise.resolve(new Map([['auth.usuario.ver', 'Ver usuarios']])),
    ),
  };
  const injector = Injector.create({
    providers: [ConsultarBitacoraUseCase, { provide: BITACORA_REMOTA_PORT, useValue: remota }],
  });
  return { remota, pagina, consultar: injector.get(ConsultarBitacoraUseCase) };
}

describe('ConsultarBitacoraUseCase', () => {
  it('lista con los filtros y la página que pide la pantalla', async () => {
    const { consultar, remota, pagina } = montar();
    expect(await consultar.listar(FILTROS, { pagina: 2, tamano: 50 })).toBe(pagina);
    expect(remota.listar).toHaveBeenCalledWith(FILTROS, { pagina: 2, tamano: 50 });
  });

  it('quienes aparecen, para el filtro «Usuario»', async () => {
    const { consultar } = montar();
    expect(await consultar.usuarios()).toEqual([{ usuarioId: 'u-1', nombreUsuario: 'ana.perez' }]);
  });

  it('un evento, con lo que cambió', async () => {
    const { consultar, remota } = montar();
    expect((await consultar.ver('e-1')).id).toBe('e-1');
    expect(remota.ver).toHaveBeenCalledWith('e-1');
  });

  it('las descripciones de los permisos', async () => {
    const { consultar } = montar();
    expect((await consultar.descripcionesPermisos()).get('auth.usuario.ver')).toBe('Ver usuarios');
  });

  it('un error del backend llega tal cual a la pantalla', async () => {
    const { consultar, remota } = montar();
    const error = new Error('sin red');
    remota.listar.mockRejectedValueOnce(error);
    await expect(consultar.listar(FILTROS, { pagina: 1, tamano: 20 })).rejects.toBe(error);
  });
});
