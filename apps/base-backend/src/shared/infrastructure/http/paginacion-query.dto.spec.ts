import { PaginacionQueryDto, pedidoPagina } from './paginacion-query.dto.js';
import { crearValidacionPipe } from './validacion.pipe.js';

/** Como llega `?pagina=…&tamano=…`: texto, por el pipe global de verdad. */
function validar(query: Record<string, string>): Promise<PaginacionQueryDto> {
  return crearValidacionPipe().transform(query, {
    type: 'query',
    metatype: PaginacionQueryDto,
  }) as Promise<PaginacionQueryDto>;
}

describe('PaginacionQueryDto', () => {
  it('sin parámetros: la primera página de 20', async () => {
    expect(pedidoPagina(await validar({}))).toEqual({ pagina: 1, tamano: 20 });
  });

  it('convierte el texto de la URL a número', async () => {
    expect(pedidoPagina(await validar({ pagina: '3', tamano: '100' }))).toEqual({
      pagina: 3,
      tamano: 100,
    });
  });

  it.each([
    [{ pagina: '0' }, 'La página empieza en 1'],
    [{ pagina: '1.5' }, 'La página debe ser un número entero'],
    [{ pagina: 'dos' }, 'La página debe ser un número entero'],
    [{ pagina: '1000001' }, 'La página no puede pasar de 1000000'],
    [{ tamano: '0' }, 'El tamaño de la página debe ser al menos 1'],
    [{ tamano: '101' }, 'El tamaño de la página no puede pasar de 100'],
    [{ tamano: '' }, 'El tamaño de la página debe ser al menos 1'],
    [{ orden: 'x' }, 'El campo orden no está permitido'],
  ])('%o → 400 «%s»', async (query, mensaje) => {
    await expect(validar(query)).rejects.toMatchObject({ message: mensaje });
  });
});
