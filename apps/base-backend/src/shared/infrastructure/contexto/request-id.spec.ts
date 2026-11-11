import type { NextFunction, Request, Response } from 'express';
import { asignarRequestId, elegirRequestId } from './request-id.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('elegirRequestId', () => {
  it('usa el que llegó si tiene formato válido (por ejemplo, el de Nginx)', () => {
    expect(elegirRequestId('0f1e2d3c4b5a69788796a5b4c3d2e1f0')).toBe(
      '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
    );
    expect(elegirRequestId('abc12345-traido')).toBe('abc12345-traido');
  });

  it.each([
    ['sin cabecera', undefined],
    ['vacío', ''],
    ['muy corto', 'abc'],
    ['muy largo', 'a'.repeat(65)],
    ['con espacios', 'abc 12345'],
    ['con salto de línea (texto falso en el log)', 'abc12345\nERROR falso'],
    ['repetido en varias cabeceras', ['abc12345', 'def67890']],
  ])('genera uno nuevo si el que llegó no sirve: %s', (_caso, recibido) => {
    expect(elegirRequestId(recibido)).toMatch(UUID);
  });
});

describe('asignarRequestId', () => {
  it('lo pone en req.id y en la cabecera de la respuesta, y guarda la hora de inicio', () => {
    const req = { headers: { 'x-request-id': 'abc12345-traido' } } as unknown as Request;
    const cabeceras = new Map<string, string>();
    const res = {
      locals: {},
      setHeader: (nombre: string, valor: string) => cabeceras.set(nombre, valor),
    } as unknown as Response;
    const next = vi.fn();

    asignarRequestId(req, res, next as unknown as NextFunction);

    expect(req.id).toBe('abc12345-traido');
    expect(cabeceras.get('x-request-id')).toBe('abc12345-traido');
    expect(typeof res.locals['inicio']).toBe('number');
    expect(next).toHaveBeenCalledOnce();
  });
});
