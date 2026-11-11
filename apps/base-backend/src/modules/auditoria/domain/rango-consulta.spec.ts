import { FechaFiscal } from '../../../shared/domain/value-objects/fecha-fiscal.vo.js';
import { RangoFechasInvalidoError } from './errors/auditoria.errors.js';
import {
  MENSAJE_RANGO_INVERTIDO,
  MENSAJE_RANGO_LARGO,
  rangoDeConsulta,
  rangoDeHistoria,
} from './rango-consulta.js';

const fecha = (texto: string) => FechaFiscal.desdeTexto(texto);

describe('rangoDeConsulta', () => {
  it('de las 00:00 de desde a antes de las 00:00 del día siguiente a hasta (Guayaquil)', () => {
    const rango = rangoDeConsulta(fecha('2026-11-01'), fecha('2026-11-05'));
    expect(rango.desde.toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(rango.hastaAntesDe.toISOString()).toBe('2026-11-06T05:00:00.000Z');
  });

  it('un solo día', () => {
    const rango = rangoDeConsulta(fecha('2026-11-05'), fecha('2026-11-05'));
    expect(rango.hastaAntesDe.getTime() - rango.desde.getTime()).toBe(86_400_000);
  });

  it('acepta 92 días contando los dos extremos y rechaza 93', () => {
    expect(() => rangoDeConsulta(fecha('2026-01-01'), fecha('2026-04-02'))).not.toThrow();
    expect(() => rangoDeConsulta(fecha('2026-01-01'), fecha('2026-04-03'))).toThrow(
      new RangoFechasInvalidoError(MENSAJE_RANGO_LARGO),
    );
  });

  it('rechaza desde mayor que hasta', () => {
    expect(() => rangoDeConsulta(fecha('2026-11-06'), fecha('2026-11-05'))).toThrow(
      new RangoFechasInvalidoError(MENSAJE_RANGO_INVERTIDO),
    );
  });
});

describe('rangoDeHistoria (6.12c0b)', () => {
  it('sin fechas, sin tope de ningún lado', () => {
    expect(rangoDeHistoria()).toEqual({ desde: undefined, hastaAntesDe: undefined });
  });

  it('con una o las dos, los mismos instantes que una búsqueda, sin el tope de 92 días', () => {
    expect(rangoDeHistoria(fecha('2020-01-01'), fecha('2026-11-05'))).toEqual({
      desde: new Date('2020-01-01T05:00:00.000Z'),
      hastaAntesDe: new Date('2026-11-06T05:00:00.000Z'),
    });
    expect(rangoDeHistoria(undefined, fecha('2026-11-05')).desde).toBeUndefined();
    expect(rangoDeHistoria(fecha('2026-11-05')).hastaAntesDe).toBeUndefined();
  });

  it('al revés, rechaza', () => {
    expect(() => rangoDeHistoria(fecha('2026-11-06'), fecha('2026-11-05'))).toThrow(
      new RangoFechasInvalidoError(MENSAJE_RANGO_INVERTIDO),
    );
  });
});
