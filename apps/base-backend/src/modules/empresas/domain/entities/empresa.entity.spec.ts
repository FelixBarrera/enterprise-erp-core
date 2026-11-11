import { NombreEmpresa } from '../value-objects/nombre-empresa.vo.js';
import { Empresa } from './empresa.entity.js';

describe('Empresa', () => {
  const empresa = Empresa.reconstruir({ id: 'e1', nombre: ' Acme ', activo: true });

  it('se reconstruye con el nombre limpio', () => {
    expect(empresa.nombre.valor).toBe('Acme');
    expect(empresa.activo).toBe(true);
  });

  it('desactivar() devuelve otra, desactivada, sin tocar la original', () => {
    const desactivada = empresa.desactivar();
    expect(desactivada.activo).toBe(false);
    expect(desactivada.id).toBe('e1');
    expect(desactivada.nombre.valor).toBe('Acme');
    expect(empresa.activo).toBe(true);
  });

  it('renombrar() devuelve otra con el nombre nuevo, sin tocar la original', () => {
    const renombrada = empresa.renombrar(NombreEmpresa.crear('Acme Andina'));
    expect(renombrada.nombre.valor).toBe('Acme Andina');
    expect(renombrada.id).toBe('e1');
    expect(renombrada.activo).toBe(true);
    expect(empresa.nombre.valor).toBe('Acme');
  });
});
