import { convertToParamMap } from '@angular/router';
import { filtrosUsuariosAUrl, filtrosUsuariosDeUrl } from './filtros-url';

const ROL = '0190a4f2-1c2b-7000-8000-000000000201';

describe('filtros de la lista de usuarios en la URL', () => {
  it('sin parámetros: los iniciales', () => {
    expect(filtrosUsuariosDeUrl(convertToParamMap({}))).toEqual({
      texto: '',
      rol: '',
      estado: 'todos',
    });
  });

  it('lee el texto (recortado), el rol y el estado', () => {
    expect(
      filtrosUsuariosDeUrl(convertToParamMap({ texto: ' perez ', rol: ROL, estado: 'activos' })),
    ).toEqual({ texto: 'perez', rol: ROL, estado: 'activos' });
  });

  it('un rol que no es un id y un estado que no existe: los iniciales', () => {
    const filtros = filtrosUsuariosDeUrl(convertToParamMap({ rol: 'caja', estado: 'borrados' }));
    expect(filtros.rol).toBe('');
    expect(filtros.estado).toBe('todos');
  });

  it('escribe solo lo que no es inicial', () => {
    expect(filtrosUsuariosAUrl({ texto: '', rol: '', estado: 'todos' })).toEqual({});
    expect(filtrosUsuariosAUrl({ texto: 'ana', rol: ROL, estado: 'desactivados' })).toEqual({
      texto: 'ana',
      rol: ROL,
      estado: 'desactivados',
    });
  });
});
