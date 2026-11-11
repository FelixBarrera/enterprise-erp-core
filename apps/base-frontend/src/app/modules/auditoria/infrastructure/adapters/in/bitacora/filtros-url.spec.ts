import { convertToParamMap } from '@angular/router';
import { filtrosBitacoraUrl } from './filtros-url';

const USUARIO = '0190a4f2-1c2b-7000-8000-000000000101';
const ROL = '0190a4f2-1c2b-7000-8000-000000000201';
const { leer, escribir, fijos } = filtrosBitacoraUrl('2026-11-07');

describe('filtros de la bitácora en la URL', () => {
  it('sin nada: los últimos 7 días, de todos, todo', () => {
    expect(leer(convertToParamMap({}))).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-07',
      usuario: '',
      accion: '',
      registro: null,
    });
  });

  it('lee lo que entiende', () => {
    expect(
      leer(
        convertToParamMap({
          desde: '2026-10-01',
          hasta: '2026-10-31',
          usuario: USUARIO,
          accion: 'auth.usuario',
        }),
      ),
    ).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-31',
      usuario: USUARIO,
      accion: 'auth.usuario',
      registro: null,
    });
  });

  it('ignora lo que no entiende', () => {
    expect(
      leer(
        convertToParamMap({
          desde: '2026-02-30',
          hasta: 'ayer',
          usuario: 'ana',
          accion: 'auth.usuario.inventada',
        }),
      ),
    ).toEqual(leer(convertToParamMap({})));
  });

  it('escribe solo lo que no es el valor inicial', () => {
    expect(escribir(leer(convertToParamMap({})))).toEqual({});
    expect(
      escribir({
        desde: '2026-10-01',
        hasta: '2026-11-07',
        usuario: USUARIO,
        accion: 'auth.rol',
        registro: null,
      }),
    ).toEqual({ desde: '2026-10-01', usuario: USUARIO, accion: 'auth.rol' });
  });

  describe('la historia de un registro', () => {
    const historia = { entidad: 'rol', entidadId: ROL };

    it('abre sin fechas y el registro no es un filtro', () => {
      const filtros = leer(convertToParamMap(historia));
      expect(filtros).toEqual({
        desde: '',
        hasta: '',
        usuario: '',
        accion: '',
        registro: historia,
      });
      expect(escribir(filtros)).toEqual({});
      expect(fijos(convertToParamMap({ ...historia, desde: '2026-10-01' }))).toEqual(historia);
    });

    it('con fechas, las escribe', () => {
      const filtros = leer(convertToParamMap({ ...historia, hasta: '2026-10-31' }));
      expect(filtros.hasta).toBe('2026-10-31');
      expect(escribir(filtros)).toEqual({ hasta: '2026-10-31' });
    });

    it('un tipo sin historia o un id que no es un UUID: toda la bitácora', () => {
      expect(leer(convertToParamMap({ entidad: 'sesion', entidadId: ROL })).registro).toBeNull();
      expect(leer(convertToParamMap({ entidad: 'rol', entidadId: 'x' })).registro).toBeNull();
      expect(fijos(convertToParamMap({ entidad: 'rol' }))).toEqual({});
    });
  });
});
