import { PaginadorEnEspanol } from './paginador-en-espanol';

describe('PaginadorEnEspanol', () => {
  const textos = new PaginadorEnEspanol();

  it('dice el rango en español', () => {
    expect(textos.itemsPerPageLabel).toBe('Filas por página');
    expect(textos.getRangeLabel(0, 20, 5)).toBe('1 – 5 de 5');
    expect(textos.getRangeLabel(1, 20, 57)).toBe('21 – 40 de 57');
    expect(textos.getRangeLabel(2, 20, 57)).toBe('41 – 57 de 57');
  });

  it('sin filas, «0 de 0»', () => {
    expect(textos.getRangeLabel(0, 20, 0)).toBe('0 de 0');
  });
});
