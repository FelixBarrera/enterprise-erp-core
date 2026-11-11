import {
  type DatosSesion,
  MotivoCierreSesion,
  SecretoPresentado,
  Sesion,
} from './sesion.entity.js';

const INICIO = new Date('2026-07-15T08:00:00-05:00');
const minutos = (n: number): Date => new Date(INICIO.getTime() + n * 60_000);
const segundosDespues = (base: Date, n: number): Date => new Date(base.getTime() + n * 1000);

function sesion(cambios: Partial<DatosSesion> = {}): Sesion {
  return Sesion.reconstruir({
    id: '0190a4f2-1c2b-7000-8000-000000000301',
    usuarioId: '0190a4f2-1c2b-7000-8000-000000000101',
    empresaId: '0190a4f2-1c2b-7000-8000-000000000001',
    hashRefresh: 'h1',
    hashRefreshAnterior: null,
    rotadoEn: null,
    iniciadaEn: INICIO,
    venceEn: Sesion.vencimiento(INICIO, 13),
    ultimoUsoEn: INICIO,
    cerradaEn: null,
    motivoCierre: null,
    ip: null,
    navegador: null,
    ...cambios,
  });
}

describe('Sesion', () => {
  it('vence a las N horas de empezar', () => {
    // 08:00 de Guayaquil (13:00 UTC) + 13 h = 02:00 UTC del día siguiente.
    expect(Sesion.vencimiento(INICIO, 13).toISOString()).toBe('2026-07-16T02:00:00.000Z');
  });

  describe('estaViva', () => {
    it('sí mientras está abierta, sin vencer y con uso reciente', () => {
      expect(sesion().estaViva(minutos(119), 120)).toBe(true);
    });

    it('no justo al cumplirse la inactividad, ni después', () => {
      expect(sesion().estaViva(minutos(120), 120)).toBe(false);
      expect(sesion().estaViva(minutos(500), 120)).toBe(false);
    });

    it('el uso (refresh) mueve la inactividad', () => {
      const usada = sesion({ ultimoUsoEn: minutos(600) });
      expect(usada.estaViva(minutos(700), 120)).toBe(true);
    });

    it('no al llegar al vencimiento, aunque se use sin parar', () => {
      const venceEn = Sesion.vencimiento(INICIO, 13);
      const usada = sesion({ ultimoUsoEn: minutos(13 * 60 - 1) });
      expect(usada.estaViva(minutos(13 * 60 - 0.5), 120)).toBe(true);
      expect(usada.estaViva(venceEn, 120)).toBe(false);
    });

    it('no si está cerrada', () => {
      const cerrada = sesion().cerrar(MotivoCierreSesion.SALIDA, minutos(1));
      expect(cerrada.estaViva(minutos(2), 120)).toBe(false);
      expect(cerrada.estaAbierta()).toBe(false);
    });
  });

  describe('reconocerSecreto', () => {
    it('el vigente', () => {
      expect(sesion().reconocerSecreto('h1', minutos(5))).toBe(SecretoPresentado.VIGENTE);
    });

    it('el anterior hasta 60 s después de rotar (inclusive)', () => {
      const rotadoEn = minutos(10);
      const rotada = sesion().rotar('h2', rotadoEn);
      expect(rotada.reconocerSecreto('h2', rotadoEn)).toBe(SecretoPresentado.VIGENTE);
      expect(rotada.reconocerSecreto('h1', segundosDespues(rotadoEn, 60))).toBe(
        SecretoPresentado.ANTERIOR,
      );
      expect(rotada.reconocerSecreto('h1', segundosDespues(rotadoEn, 61))).toBe(
        SecretoPresentado.DESCONOCIDO,
      );
    });

    it('uno que nunca fue de la sesión, o el de dos rotaciones atrás', () => {
      const dosVeces = sesion().rotar('h2', minutos(10)).rotar('h3', minutos(11));
      expect(dosVeces.reconocerSecreto('otro', minutos(11))).toBe(SecretoPresentado.DESCONOCIDO);
      expect(dosVeces.reconocerSecreto('h1', minutos(11))).toBe(SecretoPresentado.DESCONOCIDO);
      expect(dosVeces.reconocerSecreto('h2', minutos(11))).toBe(SecretoPresentado.ANTERIOR);
    });
  });

  it('rotar guarda el anterior, cuándo se rotó y cuenta como uso', () => {
    const rotada = sesion().rotar('h2', minutos(30)).datos();
    expect(rotada).toMatchObject({
      hashRefresh: 'h2',
      hashRefreshAnterior: 'h1',
      rotadoEn: minutos(30),
      ultimoUsoEn: minutos(30),
    });
  });

  it('cerrar pone la hora y el motivo; una cerrada no cambia de motivo', () => {
    const cerrada = sesion().cerrar(MotivoCierreSesion.REUSO, minutos(3));
    expect(cerrada.datos()).toMatchObject({ cerradaEn: minutos(3), motivoCierre: 'REUSO' });
    expect(cerrada.cerrar(MotivoCierreSesion.SALIDA, minutos(9))).toBe(cerrada);
  });

  it('cambiarEmpresa cambia solo la empresa activa (los secretos y el uso quedan)', () => {
    const otra = '0190a4f2-1c2b-7000-8000-000000000002';
    const original = sesion();
    const cambiada = original.cambiarEmpresa(otra);
    expect(cambiada.datos()).toEqual({ ...original.datos(), empresaId: otra });
    expect(original.empresaId).toBe('0190a4f2-1c2b-7000-8000-000000000001');
  });

  it('expone id, usuario, empresa y vencimiento', () => {
    const s = sesion();
    expect([s.id, s.usuarioId, s.empresaId]).toEqual([
      '0190a4f2-1c2b-7000-8000-000000000301',
      '0190a4f2-1c2b-7000-8000-000000000101',
      '0190a4f2-1c2b-7000-8000-000000000001',
    ]);
    expect(s.venceEn).toEqual(Sesion.vencimiento(INICIO, 13));
  });
});
