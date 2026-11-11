import { cerrarFrase } from './frases';

describe('cerrarFrase', () => {
  it('agrega el punto a una frase sin él', () => {
    expect(cerrarFrase('Roles en Comercial Andina')).toBe('Roles en Comercial Andina.');
  });

  it('no repite el punto si el dato del final ya lo trae', () => {
    expect(cerrarFrase('Roles en Comercial Andina S.A.')).toBe('Roles en Comercial Andina S.A.');
  });

  it('respeta otros cierres y quita los espacios del final', () => {
    expect(cerrarFrase('¿Seguro?')).toBe('¿Seguro?');
    expect(cerrarFrase('Listo!')).toBe('Listo!');
    expect(cerrarFrase('Y así…')).toBe('Y así…');
    expect(cerrarFrase('Empresa Sur  ')).toBe('Empresa Sur.');
  });
});
