import { convertToParamMap } from '@angular/router';
import {
  booleanoDeUrl,
  filtroAUrl,
  opcionDeUrl,
  paginaAUrl,
  paginaDeUrl,
  textoDeUrl,
} from './parametros-url';

const url = (parametros: Record<string, string>) => convertToParamMap(parametros);

describe('parámetros de la URL de una lista', () => {
  it('texto: recortado, y vacío si no está', () => {
    expect(textoDeUrl(url({ buscar: '  caja ' }), 'buscar')).toBe('caja');
    expect(textoDeUrl(url({}), 'buscar')).toBe('');
  });

  it('booleano: solo true o false; lo demás, el valor inicial', () => {
    expect(booleanoDeUrl(url({ activo: 'false' }), 'activo', true)).toBe(false);
    expect(booleanoDeUrl(url({ activo: 'true' }), 'activo', false)).toBe(true);
    expect(booleanoDeUrl(url({ activo: 'si' }), 'activo', true)).toBe(true);
    expect(booleanoDeUrl(url({}), 'activo', false)).toBe(false);
  });

  it('opción: solo una de las permitidas', () => {
    const permitidos = ['todos', 'activos', 'inactivos'] as const;
    expect(opcionDeUrl(url({ estado: 'inactivos' }), 'estado', permitidos, 'activos')).toBe(
      'inactivos',
    );
    expect(opcionDeUrl(url({ estado: 'otro' }), 'estado', permitidos, 'activos')).toBe('activos');
  });

  it('página: un entero positivo y un tamaño de los que se ofrecen', () => {
    expect(paginaDeUrl(url({ pagina: '3', tamano: '50' }))).toEqual({ pagina: 3, tamano: 50 });
    expect(paginaDeUrl(url({}))).toEqual({ pagina: 1, tamano: 20 });
    for (const pagina of ['0', '-2', '1.5', 'dos', '01', '99999999']) {
      expect(paginaDeUrl(url({ pagina })).pagina).toBe(1);
    }
    for (const tamano of ['7', '1000', 'x']) {
      expect(paginaDeUrl(url({ tamano })).tamano).toBe(20);
    }
  });

  it('página a la URL: sin los valores iniciales', () => {
    expect(paginaAUrl({ pagina: 1, tamano: 20 })).toEqual({});
    expect(paginaAUrl({ pagina: 2, tamano: 50 })).toEqual({ pagina: '2', tamano: '50' });
  });

  it('filtro a la URL: sin el valor inicial ni textos vacíos', () => {
    expect(filtroAUrl('buscar', '  ', '')).toEqual({});
    expect(filtroAUrl('buscar', ' caja ', '')).toEqual({ buscar: 'caja' });
    expect(filtroAUrl('activo', true, true)).toEqual({});
    expect(filtroAUrl('activo', false, true)).toEqual({ activo: 'false' });
  });
});
