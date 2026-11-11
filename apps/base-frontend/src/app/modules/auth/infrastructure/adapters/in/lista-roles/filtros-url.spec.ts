import { convertToParamMap } from '@angular/router';
import { filtrosRolesAUrl, filtrosRolesDeUrl } from './filtros-url';

describe('filtros de la lista de roles en la URL', () => {
  it('sin parámetros: los iniciales', () => {
    expect(filtrosRolesDeUrl(convertToParamMap({}))).toEqual({ texto: '', estado: 'todos' });
  });

  it('lee el texto (recortado) y el estado', () => {
    expect(filtrosRolesDeUrl(convertToParamMap({ texto: ' caja ', estado: 'activos' }))).toEqual({
      texto: 'caja',
      estado: 'activos',
    });
  });

  it('un estado que no existe: el inicial', () => {
    expect(filtrosRolesDeUrl(convertToParamMap({ estado: 'borrados' })).estado).toBe('todos');
  });

  it('escribe solo lo que no es inicial', () => {
    expect(filtrosRolesAUrl({ texto: '', estado: 'todos' })).toEqual({});
    expect(filtrosRolesAUrl({ texto: 'caja', estado: 'desactivados' })).toEqual({
      texto: 'caja',
      estado: 'desactivados',
    });
  });
});
