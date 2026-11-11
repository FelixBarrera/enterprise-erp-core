import { crearPagina, desplazamiento, mapearPagina } from './pagina.js';

describe('Pagina', () => {
  it('desplazamiento: la primera página no salta nada; la tercera de 20 salta 40', () => {
    expect(desplazamiento({ pagina: 1, tamano: 20 })).toBe(0);
    expect(desplazamiento({ pagina: 3, tamano: 20 })).toBe(40);
  });

  it('crearPagina: los elementos, el total y el pedido', () => {
    expect(crearPagina(['a', 'b'], 7, { pagina: 2, tamano: 2 })).toEqual({
      elementos: ['a', 'b'],
      total: 7,
      pagina: 2,
      tamano: 2,
    });
  });

  it('mapearPagina: convierte cada elemento y deja el resto igual', () => {
    const pagina = crearPagina([1, 2], 5, { pagina: 1, tamano: 2 });
    expect(mapearPagina(pagina, (n) => `n${n}`)).toEqual({
      elementos: ['n1', 'n2'],
      total: 5,
      pagina: 1,
      tamano: 2,
    });
  });
});
