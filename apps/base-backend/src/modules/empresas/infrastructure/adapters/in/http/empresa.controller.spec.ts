import type { Actor } from '../../../../../../shared/application/actor.js';
import { actorDelSistema } from '../../../../../../shared/application/actor.js';
import type { EmpresaActivaPort } from '../../../../application/ports/in/empresa-activa.port.js';
import { EmpresaController } from './empresa.controller.js';

describe('EmpresaController', () => {
  const actor: Actor = actorDelSistema({ empresaId: 'e1' });
  const empresa = { id: 'e1', nombre: 'Acme', activo: true };
  const ver = vi.fn<EmpresaActivaPort['ver']>(() => Promise.resolve(empresa));
  const editar = vi.fn<EmpresaActivaPort['editar']>(() =>
    Promise.resolve({ ...empresa, nombre: 'Acme Andina' }),
  );
  const controller = new EmpresaController({ ver, editar });

  it('ver: la empresa del actor, sin `activo`', async () => {
    expect(await controller.ver(actor)).toEqual({
      success: true,
      data: { id: 'e1', nombre: 'Acme' },
      message: 'Datos de la empresa',
    });
    expect(ver).toHaveBeenCalledWith(actor);
  });

  it('editar: pasa solo el nombre y el actor', async () => {
    expect(await controller.editar({ nombre: 'Acme Andina' }, actor)).toEqual({
      success: true,
      data: { id: 'e1', nombre: 'Acme Andina' },
      message: 'Empresa actualizada',
    });
    expect(editar).toHaveBeenCalledWith({ nombre: 'Acme Andina' }, actor);
  });
});
