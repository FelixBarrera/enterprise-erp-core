import { actorDelSistema } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import type { DesactivarEmpresaPort } from '../../../empresas/application/ports/in/desactivar-empresa.port.js';
import { MotivoCierreSesion } from '../../domain/entities/sesion.entity.js';
import { idDePrueba, SesionesEnMemoria } from '../testing/auth-en-memoria.js';
import { DesactivarEmpresaConSesionesUseCase } from './desactivar-empresa-con-sesiones.use-case.js';

const ALFA = { id: idDePrueba(1), nombre: 'Alfa', activo: true };
const BETA = idDePrueba(2);

describe('DesactivarEmpresaConSesionesUseCase', () => {
  const actor = actorDelSistema({ nombreUsuario: 'admin:desactivar-empresa' });
  let sesiones: SesionesEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let reloj: RelojFijo;

  beforeEach(() => {
    reloj = new RelojFijo('2026-07-15T09:00:00-05:00');
    sesiones = new SesionesEnMemoria();
    auditoria = new AuditoriaEnMemoria(reloj);
  });

  function armar(yaEstabaDesactivada = false) {
    const desactivar = vi.fn<DesactivarEmpresaPort['desactivar']>(() =>
      Promise.resolve({ empresa: { ...ALFA, activo: false }, yaEstabaDesactivada }),
    );
    const transacciones = { abiertas: 0 };
    const casoDeUso = new DesactivarEmpresaConSesionesUseCase(
      { desactivar },
      sesiones,
      reloj,
      {
        ejecutar: (fn) => {
          transacciones.abiertas++;
          return fn();
        },
      },
      auditoria,
    );
    return { casoDeUso, desactivar, transacciones };
  }

  it('desactiva y cierra las sesiones de esa empresa, todo dentro de una transacción', async () => {
    const deAlfa1 = sesiones.agregar({ usuarioId: idDePrueba(101), empresaId: ALFA.id });
    const deAlfa2 = sesiones.agregar({ usuarioId: idDePrueba(102), empresaId: ALFA.id });
    const deBeta = sesiones.agregar({ usuarioId: idDePrueba(101), empresaId: BETA });
    const { casoDeUso, desactivar, transacciones } = armar();

    const resultado = await casoDeUso.desactivar(ALFA.id, actor);

    expect(resultado).toMatchObject({ yaEstabaDesactivada: false, sesionesCerradas: 2 });
    expect(desactivar).toHaveBeenCalledWith(ALFA.id, actor);
    expect(transacciones.abiertas).toBe(1);
    for (const s of [deAlfa1, deAlfa2]) {
      expect(sesiones.filas.get(s.id)?.datos()).toMatchObject({
        cerradaEn: reloj.ahora(),
        motivoCierre: MotivoCierreSesion.EMPRESA_DESACTIVADA,
      });
    }
    expect(sesiones.filas.get(deBeta.id)?.estaAbierta()).toBe(true);
    expect(auditoria.acciones()).toEqual(['auth.sesion.cerrar']);
    expect(auditoria.ultimo()).toMatchObject({
      entidad: 'empresa',
      entidadId: ALFA.id,
      empresaId: ALFA.id,
    });
  });

  it('sin sesiones abiertas no registra nada más', async () => {
    const { casoDeUso } = armar();
    expect((await casoDeUso.desactivar(ALFA.id, actor)).sesionesCerradas).toBe(0);
    expect(auditoria.acciones()).toEqual([]);
  });

  it('ya desactivada: igual cierra las que hayan quedado abiertas', async () => {
    sesiones.agregar({ usuarioId: idDePrueba(101), empresaId: ALFA.id });
    const { casoDeUso } = armar(true);
    expect(await casoDeUso.desactivar(ALFA.id, actor)).toMatchObject({
      yaEstabaDesactivada: true,
      sesionesCerradas: 1,
    });
  });
});
