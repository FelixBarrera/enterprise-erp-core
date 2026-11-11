import { NombreRolInvalidoError } from '../errors/auth.errors.js';
import { descripcionRol, NombreRol } from './nombre-rol.vo.js';

describe('NombreRol', () => {
  it('recorta y junta espacios', () => {
    expect(NombreRol.crear('  Jefe   de caja ').valor).toBe('Jefe de caja');
  });

  it.each(['', ' '])('vacío (%j): obligatorio', (texto) => {
    expect(() => NombreRol.crear(texto)).toThrow(
      new NombreRolInvalidoError('El nombre del rol es obligatorio'),
    );
  });

  it('80 caracteres sirve; 81 no', () => {
    expect(NombreRol.crear('a'.repeat(80)).valor).toHaveLength(80);
    expect(() => NombreRol.crear('a'.repeat(81))).toThrow(
      'El nombre del rol no puede pasar de 80 caracteres',
    );
  });

  it('en el JSON y como texto sale el valor', () => {
    const nombre = NombreRol.crear('Caja');
    expect(JSON.stringify({ nombre })).toBe('{"nombre":"Caja"}');
    expect(String(nombre)).toBe('Caja');
  });
});

describe('descripcionRol', () => {
  it('null, vacía o espacios: null (nunca se guarda "")', () => {
    expect(descripcionRol(null)).toBeNull();
    expect(descripcionRol('')).toBeNull();
    expect(descripcionRol('   ')).toBeNull();
  });

  it('recorta; 250 sirve, 251 no', () => {
    expect(descripcionRol('  Cobra  en caja ')).toBe('Cobra en caja');
    expect(descripcionRol('a'.repeat(250))).toHaveLength(250);
    expect(() => descripcionRol('a'.repeat(251))).toThrow(
      'La descripción del rol no puede pasar de 250 caracteres',
    );
  });
});
