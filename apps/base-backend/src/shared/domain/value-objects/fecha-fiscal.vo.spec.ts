import { FechaInvalidaError } from '../errors/valores.errors.js';
import {
  fijarZonaNegocio,
  partesEnZonaNegocio,
  ZONA_NEGOCIO_POR_DEFECTO,
} from '../zona-negocio.js';
import { FechaFiscal } from './fecha-fiscal.vo.js';

// Zonas donde podría estar el servidor. Todas deben dar el mismo resultado: el de Guayaquil.
const ZONAS_DEL_SERVIDOR = [
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Pacific/Kiritimati', // UTC+14: el primer lugar del mundo en cambiar de día
];

describe.each(ZONAS_DEL_SERVIDOR)('con el servidor en %s', (zona) => {
  const zonaOriginal = process.env['TZ'];

  beforeAll(() => {
    // Node cambia la zona del proceso en el acto al asignar TZ.
    process.env['TZ'] = zona;
  });

  afterAll(() => {
    process.env['TZ'] = zonaOriginal;
  });

  it('el proceso de verdad está en esa zona (si no, la prueba no probaría nada)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zona);
  });

  it('a las 11:00 de Guayaquil, el sistema dice 11:00, aunque el servidor tenga otra hora', () => {
    const instante = new Date('2026-07-15T11:00:00-05:00');
    expect(partesEnZonaNegocio(instante)).toEqual({
      anio: 2026,
      mes: 7,
      dia: 15,
      hora: 11,
      minuto: 0,
      segundo: 0,
    });
  });

  it('una operación de las 20:00 en Guayaquil es de ese día (en UTC ya es el siguiente)', () => {
    const instante = new Date('2026-11-05T20:00:00-05:00'); // 2026-11-06T01:00Z
    expect(FechaFiscal.desdeInstante(instante).aTexto()).toBe('2026-11-05');
  });

  it('a las 00:30 de Guayaquil ya es el día nuevo (en Los Ángeles todavía es el anterior)', () => {
    const instante = new Date('2026-11-06T00:30:00-05:00');
    expect(FechaFiscal.desdeInstante(instante).aTexto()).toBe('2026-11-06');
  });

  it('el último segundo del año en Guayaquil sigue siendo del año viejo', () => {
    const instante = new Date('2026-12-31T23:59:59-05:00');
    expect(FechaFiscal.desdeInstante(instante).aTexto()).toBe('2026-12-31');
  });

  it('ida y vuelta con la base (@db.Date) no corre el día', () => {
    const fecha = FechaFiscal.desdeTexto('2026-11-05');
    expect(fecha.aFechaDb().toISOString()).toBe('2026-11-05T00:00:00.000Z');
    expect(FechaFiscal.desdeFechaDb(fecha.aFechaDb()).esIgualA(fecha)).toBe(true);
  });
});

describe('ejemplo: servidor en Nueva York (julio, horario de verano)', () => {
  it('allá son las 13:00 y en Guayaquil las 12:00: el sistema registra las 12:00', () => {
    // Es la zona de todas las pruebas unitarias (vitest.config.ts).
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York');
    const instante = new Date('2026-07-15T13:00:00-04:00'); // 13:00 en Nueva York
    expect(instante.getHours()).toBe(13); // lo que diría el servidor si se le preguntara
    expect(partesEnZonaNegocio(instante).hora).toBe(12); // lo que usa el sistema
  });
});

describe('FechaFiscal', () => {
  describe('desdeTexto', () => {
    it('lee aaaa-mm-dd', () => {
      const fecha = FechaFiscal.desdeTexto('2026-02-28');
      expect([fecha.anio, fecha.mes, fecha.dia]).toEqual([2026, 2, 28]);
    });

    it('acepta el 29 de febrero de un año bisiesto', () => {
      expect(FechaFiscal.desdeTexto('2028-02-29').aTexto()).toBe('2028-02-29');
    });

    it.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00', '1899-12-31'])(
      'rechaza la fecha que no existe o está fuera de rango: %s',
      (texto) => {
        expect(() => FechaFiscal.desdeTexto(texto)).toThrow(FechaInvalidaError);
      },
    );

    it.each(['05/11/2026', '2026-1-5', '2026-11-05T10:00:00', '', ' 2026-11-05', 'hoy'])(
      'rechaza el formato que no es aaaa-mm-dd: "%s"',
      (texto) => {
        expect(() => FechaFiscal.desdeTexto(texto)).toThrow(
          'La fecha debe tener el formato aaaa-mm-dd',
        );
      },
    );
  });

  it('rechaza un instante inválido', () => {
    expect(() => FechaFiscal.desdeInstante(new Date('no es fecha'))).toThrow(FechaInvalidaError);
    expect(() => FechaFiscal.desdeFechaDb(new Date('no es fecha'))).toThrow(FechaInvalidaError);
  });

  it('formatoSri da dd/mm/aaaa', () => {
    expect(FechaFiscal.desdeTexto('2026-03-07').formatoSri()).toBe('07/03/2026');
  });

  it('en el JSON sale como aaaa-mm-dd', () => {
    const fecha = FechaFiscal.desdeTexto('2026-03-07');
    expect(JSON.stringify({ fecha })).toBe('{"fecha":"2026-03-07"}');
    expect(String(fecha)).toBe('2026-03-07');
  });

  describe('sumarDias', () => {
    it('cruza meses, años y bisiestos', () => {
      expect(FechaFiscal.desdeTexto('2026-12-30').sumarDias(3).aTexto()).toBe('2027-01-02');
      expect(FechaFiscal.desdeTexto('2028-02-28').sumarDias(1).aTexto()).toBe('2028-02-29');
      expect(FechaFiscal.desdeTexto('2026-03-01').sumarDias(-1).aTexto()).toBe('2026-02-28');
      expect(FechaFiscal.desdeTexto('2026-03-01').sumarDias(0).aTexto()).toBe('2026-03-01');
    });

    it('rechaza días con decimales', () => {
      expect(() => FechaFiscal.desdeTexto('2026-03-01').sumarDias(1.5)).toThrow(
        'Los días a sumar deben ser un número entero',
      );
    });
  });

  it('compara fechas', () => {
    const antes = FechaFiscal.desdeTexto('2026-11-04');
    const despues = FechaFiscal.desdeTexto('2026-11-05');
    expect(antes.compararCon(despues)).toBe(-1);
    expect(despues.compararCon(antes)).toBe(1);
    expect(antes.compararCon(FechaFiscal.desdeTexto('2026-11-04'))).toBe(0);
    expect(antes.esAnteriorA(despues)).toBe(true);
    expect(despues.esPosteriorA(antes)).toBe(true);
    expect(antes.esIgualA(despues)).toBe(false);
  });
});

describe('inicioDelDia', () => {
  afterEach(() => {
    fijarZonaNegocio(ZONA_NEGOCIO_POR_DEFECTO);
  });

  it.each(ZONAS_DEL_SERVIDOR)('es la medianoche de Guayaquil con el servidor en %s', (zona) => {
    const zonaOriginal = process.env['TZ'];
    process.env['TZ'] = zona;
    try {
      expect(FechaFiscal.desdeTexto('2026-11-05').inicioDelDia().toISOString()).toBe(
        '2026-11-05T05:00:00.000Z',
      );
      expect(FechaFiscal.desdeTexto('2027-01-01').inicioDelDia().toISOString()).toBe(
        '2027-01-01T05:00:00.000Z',
      );
    } finally {
      process.env['TZ'] = zonaOriginal;
    }
  });

  it('sigue el horario de verano de la zona del negocio', () => {
    fijarZonaNegocio('Europe/Madrid');
    expect(FechaFiscal.desdeTexto('2026-07-15').inicioDelDia().toISOString()).toBe(
      '2026-07-14T22:00:00.000Z',
    );
    expect(FechaFiscal.desdeTexto('2026-01-15').inicioDelDia().toISOString()).toBe(
      '2026-01-14T23:00:00.000Z',
    );
    // El día del cambio (29 de marzo, a las 02:00) empieza todavía en invierno.
    expect(FechaFiscal.desdeTexto('2026-03-29').inicioDelDia().toISOString()).toBe(
      '2026-03-28T23:00:00.000Z',
    );
  });

  it('si la medianoche no existe (el reloj salta de 00:00 a 01:00), es el primer instante del día', () => {
    // Chile adelanta el reloj a las 00:00 del primer domingo de septiembre (6 en 2026).
    fijarZonaNegocio('America/Santiago');
    const inicio = FechaFiscal.desdeTexto('2026-09-06').inicioDelDia();
    expect(inicio.toISOString()).toBe('2026-09-06T04:00:00.000Z');
    expect(partesEnZonaNegocio(inicio)).toMatchObject({ dia: 6, hora: 1, minuto: 0 });
    // Un milisegundo antes todavía es el día anterior.
    expect(FechaFiscal.desdeInstante(new Date(inicio.getTime() - 1)).aTexto()).toBe('2026-09-05');
    // Y el día en que se atrasa (5 de abril, 00:00 → 23:00 del 4): su medianoche ya es invierno.
    expect(FechaFiscal.desdeTexto('2026-04-05').inicioDelDia().toISOString()).toBe(
      '2026-04-05T04:00:00.000Z',
    );
  });
});
