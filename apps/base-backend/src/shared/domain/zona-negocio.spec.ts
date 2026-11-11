import { ZonaHorariaInvalidaError } from './errors/valores.errors.js';
import { FechaFiscal } from './value-objects/fecha-fiscal.vo.js';
import {
  esZonaHorariaValida,
  fijarZonaNegocio,
  partesEnZonaNegocio,
  ZONA_NEGOCIO_POR_DEFECTO,
  zonaNegocio,
} from './zona-negocio.js';

describe('zona del negocio', () => {
  afterEach(() => {
    fijarZonaNegocio(ZONA_NEGOCIO_POR_DEFECTO);
  });

  it('por defecto es Guayaquil', () => {
    expect(zonaNegocio()).toBe('America/Guayaquil');
  });

  it('acepta nombres de zona exactos y UTC', () => {
    for (const zona of ['America/Guayaquil', 'America/Mexico_City', 'Europe/Madrid', 'UTC']) {
      expect(esZonaHorariaValida(zona)).toBe(true);
    }
  });

  it('rechaza zonas mal escritas, desfases sueltos y abreviaturas', () => {
    for (const zona of ['America/Guayakil', 'america/guayaquil', '-05:00', 'EST', '']) {
      expect(esZonaHorariaValida(zona)).toBe(false);
    }
  });

  it('no deja fijar una zona que no existe (y se queda con la que tenía)', () => {
    expect(() => fijarZonaNegocio('America/Guayakil')).toThrow(ZonaHorariaInvalidaError);
    expect(zonaNegocio()).toBe('America/Guayaquil');
  });

  describe('en otra instalación, con ZONA_NEGOCIO=America/Mexico_City (UTC-6)', () => {
    // 05:30 UTC del 6 de noviembre = 00:30 del 6 en Guayaquil = 23:30 del 5 en Ciudad de México.
    const instante = new Date('2026-11-06T05:30:00Z');

    it('en Guayaquil ya es el día 6', () => {
      expect(FechaFiscal.desdeInstante(instante).aTexto()).toBe('2026-11-06');
    });

    it('al fijar Ciudad de México, la hora y el día salen de esa zona', () => {
      fijarZonaNegocio('America/Mexico_City');
      expect(zonaNegocio()).toBe('America/Mexico_City');
      expect(partesEnZonaNegocio(instante)).toMatchObject({ dia: 5, hora: 23, minuto: 30 });
      expect(FechaFiscal.desdeInstante(instante).aTexto()).toBe('2026-11-05');
    });
  });
});
