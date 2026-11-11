import { actorDelSistema } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import { MotivoCierreSesion, type Sesion } from '../../domain/entities/sesion.entity.js';
import { idDePrueba, SesionesEnMemoria } from '../testing/auth-en-memoria.js';
import { CerrarSesionUseCase } from './cerrar-sesion.use-case.js';

const USUARIO = idDePrueba(101);
const EMPRESA = idDePrueba(1);

describe('CerrarSesionUseCase', () => {
  let reloj: RelojFijo;
  let sesiones: SesionesEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let casoDeUso: CerrarSesionUseCase;
  let sesion: Sesion;
  let otra: Sesion;
  const actor = { ...actorDelSistema({ empresaId: EMPRESA }), usuarioId: USUARIO };

  beforeEach(() => {
    reloj = new RelojFijo('2026-07-15T09:00:00-05:00');
    sesiones = new SesionesEnMemoria();
    auditoria = new AuditoriaEnMemoria(reloj);
    casoDeUso = new CerrarSesionUseCase(sesiones, reloj, { ejecutar: (fn) => fn() }, auditoria);
    sesion = sesiones.agregar({ usuarioId: USUARIO, empresaId: EMPRESA });
    otra = sesiones.agregar({ usuarioId: USUARIO, empresaId: EMPRESA });
  });

  it('cierra solo esta sesión, con motivo SALIDA, y lo registra', async () => {
    await casoDeUso.execute(sesion.id, actor);

    expect(sesiones.filas.get(sesion.id)?.datos()).toMatchObject({
      cerradaEn: reloj.ahora(),
      motivoCierre: MotivoCierreSesion.SALIDA,
    });
    expect(sesiones.filas.get(otra.id)?.estaAbierta()).toBe(true);
    expect(auditoria.acciones()).toEqual(['auth.sesion.cerrar']);
    expect(auditoria.ultimo()).toMatchObject({
      entidad: 'sesion',
      entidadId: sesion.id,
      usuarioId: USUARIO,
      empresaId: EMPRESA,
    });
  });

  it('si ya estaba cerrada (o no existe) no cambia nada ni registra otra vez', async () => {
    await casoDeUso.execute(sesion.id, actor);
    reloj.avanzarMinutos(5);
    await casoDeUso.execute(sesion.id, actor);
    await casoDeUso.execute(idDePrueba(999), actor);

    expect(sesiones.filas.get(sesion.id)?.datos().cerradaEn).toEqual(
      new Date('2026-07-15T09:00:00-05:00'),
    );
    expect(auditoria.acciones()).toEqual(['auth.sesion.cerrar']);
  });
});
