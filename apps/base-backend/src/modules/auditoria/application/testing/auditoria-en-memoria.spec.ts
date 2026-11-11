import { actorDelSistema } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { VALOR_OCULTO } from '../../domain/evento-auditoria.js';
import { AuditoriaEnMemoria } from './auditoria-en-memoria.js';

describe('AuditoriaEnMemoria', () => {
  it('guarda lo mismo que la real (con lo sensible oculto)', async () => {
    const auditoria = new AuditoriaEnMemoria(undefined, { catalogo: null });
    await auditoria.registrar(
      { accion: 'auth.usuario.crear', despues: { nombre: 'Ana', contrasena: 'x' } },
      actorDelSistema(),
    );
    await auditoria.registrar(
      { accion: 'auth.usuario.editar', antes: { a: 1 }, despues: { a: 1 } },
      actorDelSistema(),
    );
    expect(auditoria.acciones()).toEqual(['auth.usuario.crear']);
    expect(auditoria.ultimo().despues).toEqual({ nombre: 'Ana', contrasena: VALOR_OCULTO });
  });

  it('usa el reloj que se le pasa', async () => {
    const auditoria = new AuditoriaEnMemoria(new RelojFijo('2026-01-02T08:00:00-05:00'));
    await auditoria.registrar({ accion: 'auth.sesion.iniciar' }, actorDelSistema());
    expect(auditoria.ultimo().ocurridoEn).toEqual(new Date('2026-01-02T13:00:00Z'));
  });

  it('falla con lo que no está en el catálogo de la bitácora', async () => {
    const auditoria = new AuditoriaEnMemoria();
    await expect(
      auditoria.registrar({ accion: 'ventas.factura.emitir' }, actorDelSistema()),
    ).rejects.toThrow('la acción "ventas.factura.emitir" no está en src/catalogo-auditoria.ts');
    await expect(
      auditoria.registrar(
        { accion: 'auth.sesion.cerrar', despues: { motivoCierre: 'OTRO', color: 'rojo' } },
        actorDelSistema(),
      ),
    ).rejects.toThrow(
      'el valor "OTRO" de "motivoCierre" (en auth.sesion.cerrar); el campo "color" (en auth.sesion.cerrar)',
    );
    expect(auditoria.eventos).toEqual([]);
  });

  it('con lo del catálogo registra igual que siempre', async () => {
    const auditoria = new AuditoriaEnMemoria();
    await auditoria.registrar(
      { accion: 'auth.sesion.cerrar', despues: { motivoCierre: 'SALIDA', sesionesCerradas: 1 } },
      actorDelSistema(),
    );
    expect(auditoria.acciones()).toEqual(['auth.sesion.cerrar']);
  });

  it('ultimo() falla si no hay eventos', () => {
    expect(() => new AuditoriaEnMemoria().ultimo()).toThrow('ningún evento');
  });
});
