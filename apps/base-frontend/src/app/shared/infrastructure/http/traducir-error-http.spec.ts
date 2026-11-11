import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TipoErrorHttp } from '../../domain/errors/error-http';
import { traducirErrorHttp } from './traducir-error-http';

function deLaApi(status: number, message: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: { success: false, data: null, message },
    headers: new HttpHeaders({ 'x-request-id': 'req-1' }),
  });
}

function sinCuerpoDeLaApi(status: number, error: unknown = '<html>error</html>') {
  return new HttpErrorResponse({ status, error });
}

describe('traducirErrorHttp', () => {
  it.each([
    [400, TipoErrorHttp.VALIDACION],
    [403, TipoErrorHttp.NO_AUTORIZADO],
    [404, TipoErrorHttp.NO_ENCONTRADO],
    [409, TipoErrorHttp.CONFLICTO],
    [422, TipoErrorHttp.REGLA_NEGOCIO],
    [429, TipoErrorHttp.DEMASIADAS_PETICIONES],
    [418, TipoErrorHttp.SOLICITUD_RECHAZADA],
  ])('%i de la API → %s con el mensaje del backend', (estado, tipo) => {
    const error = traducirErrorHttp(deLaApi(estado, 'Mensaje del backend'), true);
    expect(error.tipo).toBe(tipo);
    expect(error.message).toBe('Mensaje del backend');
    expect(error.estado).toBe(estado);
    expect(error.respondioLaApi).toBe(true);
    expect(error.requestId).toBe('req-1');
  });

  it('401 → NO_AUTENTICADO, sin aviso global (lo resuelve el interceptor de auth)', () => {
    const error = traducirErrorHttp(deLaApi(401, 'Sesión vencida'), true);
    expect(error.tipo).toBe(TipoErrorHttp.NO_AUTENTICADO);
    expect(error.avisado).toBe(false);
  });

  it('un 4xx que no mandó la API usa el mensaje propio del tipo', () => {
    const error = traducirErrorHttp(sinCuerpoDeLaApi(404), true);
    expect(error.message).toBe('No se encontró lo que busca.');
    expect(error.respondioLaApi).toBe(false);
    expect(error.requestId).toBeNull();
  });

  it('un mensaje vacío de la API usa el mensaje propio del tipo', () => {
    expect(traducirErrorHttp(deLaApi(409, '  '), true).message).toBe(
      'No se pudo guardar porque los datos cambiaron o ya existen.',
    );
  });

  it('sin red (estado 0) → SIN_CONEXION, avisado', () => {
    const error = traducirErrorHttp(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }),
      true,
    );
    expect(error.tipo).toBe(TipoErrorHttp.SIN_CONEXION);
    expect(error.message).toBe(
      'No hay conexión con el servidor. Revise su internet e intente de nuevo.',
    );
    expect(error.avisado).toBe(true);
  });

  it.each([502, 503, 504])('%i → SERVIDOR_NO_DISPONIBLE, aunque lo mande la API', (estado) => {
    const error = traducirErrorHttp(deLaApi(estado, 'El servicio no está disponible'), true);
    expect(error.tipo).toBe(TipoErrorHttp.SERVIDOR_NO_DISPONIBLE);
    expect(error.message).toBe('El servidor no está disponible. Intente de nuevo en unos minutos.');
    expect(error.respondioLaApi).toBe(true);
  });

  it('500 que no mandó la API (proxy con la API apagada) → SERVIDOR_NO_DISPONIBLE', () => {
    expect(traducirErrorHttp(sinCuerpoDeLaApi(500, null), true).tipo).toBe(
      TipoErrorHttp.SERVIDOR_NO_DISPONIBLE,
    );
  });

  it('500 de la API → ERROR_SERVIDOR con un texto genérico (nunca el del servidor)', () => {
    const error = traducirErrorHttp(deLaApi(500, 'detalle interno'), true);
    expect(error.tipo).toBe(TipoErrorHttp.ERROR_SERVIDOR);
    expect(error.message).toBe(
      'Ocurrió un error en el servidor. Intente de nuevo; si se repite, avise a soporte.',
    );
  });

  it('avisado solo si es de aviso global y la petición lo permite', () => {
    expect(traducirErrorHttp(deLaApi(403, 'Sin permiso'), true).avisado).toBe(true);
    expect(traducirErrorHttp(deLaApi(403, 'Sin permiso'), false).avisado).toBe(false);
    expect(traducirErrorHttp(deLaApi(404, 'No existe'), true).avisado).toBe(false);
  });

  it('un cuerpo con success: true no se toma como respuesta de error de la API', () => {
    const error = traducirErrorHttp(
      sinCuerpoDeLaApi(400, { success: true, message: 'raro' }),
      true,
    );
    expect(error.respondioLaApi).toBe(false);
    expect(error.message).toBe('Revise los datos ingresados.');
  });
});
