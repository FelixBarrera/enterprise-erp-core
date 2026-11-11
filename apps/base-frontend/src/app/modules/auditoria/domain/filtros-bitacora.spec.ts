import { filtrosBitacoraIniciales, textoRango } from './filtros-bitacora';

const USUARIO = { entidad: 'usuario', entidadId: '0190a4f2-1c2b-7000-8000-000000000102' };

describe('filtros de la bitácora', () => {
  it('abre con los últimos 7 días, hoy incluido', () => {
    expect(filtrosBitacoraIniciales('2026-11-07')).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-07',
      usuario: '',
      accion: '',
      registro: null,
    });
    expect(filtrosBitacoraIniciales('2026-01-03').desde).toBe('2025-12-28');
  });

  it('la historia de un registro abre sin fechas', () => {
    expect(filtrosBitacoraIniciales('2026-11-07', USUARIO)).toEqual({
      desde: '',
      hasta: '',
      usuario: '',
      accion: '',
      registro: USUARIO,
    });
  });

  it('el rango en corto para el celular', () => {
    expect(textoRango('2026-11-01', '2026-11-07')).toBe('01/11 – 07/11/2026');
    expect(textoRango('2025-12-28', '2026-01-03')).toBe('28/12/2025 – 03/01/2026');
    expect(textoRango('2026-11-07', '2026-11-07')).toBe('07/11/2026');
  });

  it('el rango con una fecha vacía (la historia de un registro)', () => {
    expect(textoRango('', '')).toBe('Todas las fechas');
    expect(textoRango('2026-11-01', '')).toBe('Desde 01/11/2026');
    expect(textoRango('', '2026-11-07')).toBe('Hasta 07/11/2026');
  });
});
