import {
  diaATexto,
  diaEnZona,
  esDia,
  fechaEnZona,
  fechaHoraEnZona,
  fechaHoraSegundosEnZona,
  lugarDeZona,
  sumarDias,
  ZONA_NEGOCIO_POR_DEFECTO,
} from './fechas';

// Las pruebas corren con el proceso en Nueva York (vitest.config.mts): nada depende de esa zona.
describe('fechas en la zona del negocio', () => {
  it('muestra el día y la hora en Guayaquil, no en la zona del proceso', () => {
    expect(fechaHoraEnZona('2026-11-02T15:15:00.000Z', ZONA_NEGOCIO_POR_DEFECTO)).toBe(
      '02/11/2026 10:15',
    );
  });

  it('con segundos, para el detalle de la bitácora', () => {
    expect(fechaHoraSegundosEnZona('2026-11-07T15:42:18.500Z', ZONA_NEGOCIO_POR_DEFECTO)).toBe(
      '07/11/2026 10:42:18',
    );
    expect(fechaHoraSegundosEnZona('no es fecha', ZONA_NEGOCIO_POR_DEFECTO)).toBe('');
  });

  it('cerca de la medianoche, el día es el de la zona del negocio', () => {
    // 04:30 en UTC del día 3 son las 23:30 del día 2 en Guayaquil.
    expect(fechaEnZona('2026-11-03T04:30:00.000Z', ZONA_NEGOCIO_POR_DEFECTO)).toBe('02/11/2026');
    expect(fechaEnZona('2026-11-03T04:30:00.000Z', 'Europe/Madrid')).toBe('03/11/2026');
  });

  it('usa 24 horas, con la medianoche como 00', () => {
    expect(fechaHoraEnZona('2026-11-02T05:05:00.000Z', ZONA_NEGOCIO_POR_DEFECTO)).toBe(
      '02/11/2026 00:05',
    );
  });

  it('un texto que no es una fecha da vacío', () => {
    expect(fechaHoraEnZona('no es fecha', ZONA_NEGOCIO_POR_DEFECTO)).toBe('');
    expect(fechaEnZona('', ZONA_NEGOCIO_POR_DEFECTO)).toBe('');
  });
});

describe('días del negocio (aaaa-mm-dd)', () => {
  it('el día de un instante es el de la zona del negocio', () => {
    // 04:30 en UTC del día 3 son las 23:30 del día 2 en Guayaquil.
    const instante = new Date('2026-11-03T04:30:00.000Z');
    expect(diaEnZona(instante, ZONA_NEGOCIO_POR_DEFECTO)).toBe('2026-11-02');
    expect(diaEnZona(instante, 'Europe/Madrid')).toBe('2026-11-03');
  });

  it('reconoce solo días reales', () => {
    expect(esDia('2026-11-07')).toBe(true);
    expect(esDia('2024-02-29')).toBe(true);
    expect(esDia('2026-02-29')).toBe(false);
    expect(esDia('2026-13-01')).toBe(false);
    expect(esDia('7/11/2026')).toBe(false);
    expect(esDia('')).toBe(false);
  });

  it('suma y resta días, también entre meses y años', () => {
    expect(sumarDias('2026-11-07', -6)).toBe('2026-11-01');
    expect(sumarDias('2026-03-02', -2)).toBe('2026-02-28');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('«07/11/2026» de un día', () => {
    expect(diaATexto('2026-11-07')).toBe('07/11/2026');
  });
});

describe('lugarDeZona', () => {
  it('el lugar, sin la región ni guiones bajos', () => {
    expect(lugarDeZona('America/Guayaquil')).toBe('Guayaquil');
    expect(lugarDeZona('America/New_York')).toBe('New York');
    expect(lugarDeZona('UTC')).toBe('UTC');
  });
});
