import { TAMANO_PAGINA_POR_DEFECTO, TAMANOS_PAGINA, ultimaPagina } from './pagina';

describe('pagina', () => {
  it('el tamaño de siempre está entre los que se pueden elegir', () => {
    expect(TAMANOS_PAGINA).toContain(TAMANO_PAGINA_POR_DEFECTO);
  });

  it('la última página redondea hacia arriba y nunca baja de 1', () => {
    expect(ultimaPagina(41, 20)).toBe(3);
    expect(ultimaPagina(40, 20)).toBe(2);
    expect(ultimaPagina(0, 20)).toBe(1);
  });
});
