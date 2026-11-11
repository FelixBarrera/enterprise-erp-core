import { NombreEmpresaInvalidoError } from '../errors/empresas.errors.js';
import { NombreEmpresa } from './nombre-empresa.vo.js';

describe('NombreEmpresa', () => {
  it('recorta y junta los espacios repetidos', () => {
    expect(NombreEmpresa.crear('  Comercial   del  Sur \n').valor).toBe('Comercial del Sur');
  });

  it('normaliza a NFC: la "é" de dos formas queda igual', () => {
    const compuesta = NombreEmpresa.crear('Café');
    const separada = NombreEmpresa.crear('Café');
    expect(separada.valor).toBe(compuesta.valor);
  });

  it.each(['', '   ', '\t\n'])('vacío (%j): obligatorio', (texto) => {
    expect(() => NombreEmpresa.crear(texto)).toThrow(
      new NombreEmpresaInvalidoError('El nombre de la empresa es obligatorio'),
    );
  });

  it('150 caracteres sirve; 151 no', () => {
    expect(NombreEmpresa.crear('a'.repeat(150)).valor).toHaveLength(150);
    expect(() => NombreEmpresa.crear('a'.repeat(151))).toThrow(
      'El nombre de la empresa no puede pasar de 150 caracteres',
    );
  });

  it('en el JSON y como texto sale el valor', () => {
    const nombre = NombreEmpresa.crear('Acme');
    expect(JSON.stringify({ nombre })).toBe('{"nombre":"Acme"}');
    expect(nombre.toString()).toBe('Acme');
  });
});
