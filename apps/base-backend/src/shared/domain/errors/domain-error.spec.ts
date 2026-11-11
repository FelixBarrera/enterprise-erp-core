import { DomainError, TipoErrorDominio } from './domain-error.js';

class ClienteNoEncontradoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.NO_ENCONTRADO, 'El cliente no existe');
  }
}

describe('DomainError', () => {
  it('guarda el tipo y el mensaje', () => {
    const error = new DomainError(TipoErrorDominio.CONFLICTO, 'Ya existe');
    expect(error.tipo).toBe('CONFLICTO');
    expect(error.message).toBe('Ya existe');
    expect(error).toBeInstanceOf(Error);
  });

  it('una subclase conserva su nombre y sigue siendo DomainError', () => {
    const error = new ClienteNoEncontradoError();
    expect(error.name).toBe('ClienteNoEncontradoError');
    expect(error).toBeInstanceOf(DomainError);
    expect(error.tipo).toBe('NO_ENCONTRADO');
  });
});
