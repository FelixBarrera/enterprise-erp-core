import { type EventoResumen, textoQuien, textoSobreQue } from './evento';

const evento = (cambios: Partial<EventoResumen> = {}): EventoResumen => ({
  id: 'ev-1',
  ocurridoEn: '2026-11-07T15:42:00.000Z',
  usuarioId: 'u-1',
  nombreUsuario: 'ana.perez',
  accion: 'auth.usuario.asignar_roles',
  entidad: 'usuario',
  entidadId: 'u-2',
  entidadNombre: 'jorge.vera',
  ...cambios,
});

describe('textoSobreQue', () => {
  it('el tipo y el nombre que tenía en ese momento', () => {
    expect(textoSobreQue(evento())).toBe('Usuario jorge.vera');
    expect(textoSobreQue(evento({ entidad: 'rol', entidadNombre: 'Contabilidad' }))).toBe(
      'Rol Contabilidad',
    );
    expect(textoSobreQue(evento({ entidad: 'empresa', entidadNombre: 'Casa Uno' }))).toBe(
      'Empresa Casa Uno',
    );
    expect(textoSobreQue(evento({ entidad: 'sesion', entidadNombre: 'ana.perez' }))).toBe(
      'Sesión de ana.perez',
    );
  });

  it('los eventos viejos, sin el nombre', () => {
    const sin = { entidadNombre: null };
    expect(textoSobreQue(evento(sin))).toBe('Un usuario');
    expect(textoSobreQue(evento({ ...sin, entidad: 'rol' }))).toBe('Un rol');
    expect(textoSobreQue(evento({ ...sin, entidad: 'empresa' }))).toBe('La empresa');
    expect(textoSobreQue(evento({ ...sin, entidad: 'sesion' }))).toBe('Una sesión');
  });

  it('sin registro, vacío; un tipo desconocido, su nombre o su código', () => {
    expect(textoSobreQue(evento({ entidad: null, entidadId: null, entidadNombre: null }))).toBe('');
    expect(textoSobreQue(evento({ entidad: 'factura', entidadNombre: '001-001-7' }))).toBe(
      '001-001-7',
    );
    expect(textoSobreQue(evento({ entidad: 'factura', entidadNombre: null }))).toBe('factura');
  });
});

describe('textoQuien', () => {
  it('su usuario, o «El sistema» si fue un proceso', () => {
    expect(textoQuien(evento())).toBe('ana.perez');
    expect(textoQuien(evento({ usuarioId: null, nombreUsuario: null }))).toBe('El sistema');
  });
});
