import { NombreCompletoInvalidoError } from '../errors/auth.errors.js';
import { NombreCompleto } from './nombre-completo.vo.js';

describe('NombreCompleto', () => {
  it('recorta, junta espacios y normaliza a NFC', () => {
    expect(NombreCompleto.crear('  Ana   Pérez ').valor).toBe('Ana Pérez');
    expect(NombreCompleto.crear('Pérez').valor).toBe('Pérez');
  });

  it.each(['', '  '])('vacío (%j): obligatorio', (texto) => {
    expect(() => NombreCompleto.crear(texto)).toThrow(
      new NombreCompletoInvalidoError('El nombre completo es obligatorio'),
    );
  });

  it('150 caracteres sirve; 151 no', () => {
    expect(NombreCompleto.crear('a'.repeat(150)).valor).toHaveLength(150);
    expect(() => NombreCompleto.crear('a'.repeat(151))).toThrow(
      'El nombre completo no puede pasar de 150 caracteres',
    );
  });

  it('en el JSON y como texto sale el valor', () => {
    const nombre = NombreCompleto.crear('Ana');
    expect(JSON.stringify({ nombre })).toBe('{"nombre":"Ana"}');
    expect(String(nombre)).toBe('Ana');
  });
});
