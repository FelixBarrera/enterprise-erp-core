import {
  type ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DomainError, TipoErrorDominio } from '../../domain/errors/domain-error.js';
import { FiltroErroresFilter } from './filtro-errores.filter.js';
import { SolicitudInvalidaException } from './solicitud-invalida.exception.js';

function ejecutar(error: unknown) {
  const locals: Record<string, unknown> = {};
  const resultado = { estado: 0, cuerpo: undefined as unknown };
  const respuesta = {
    locals,
    status(estado: number) {
      resultado.estado = estado;
      return respuesta;
    },
    json(cuerpo: unknown) {
      resultado.cuerpo = cuerpo;
      return respuesta;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => respuesta }),
  } as unknown as ArgumentsHost;
  new FiltroErroresFilter().catch(error, host);
  return { resultado, locals };
}

function capturar(error: unknown): { estado: number; cuerpo: unknown } {
  return ejecutar(error).resultado;
}

describe('FiltroErroresFilter', () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  it.each([
    [TipoErrorDominio.VALIDACION, 400],
    [TipoErrorDominio.NO_AUTENTICADO, 401],
    [TipoErrorDominio.NO_AUTORIZADO, 403],
    [TipoErrorDominio.NO_ENCONTRADO, 404],
    [TipoErrorDominio.CONFLICTO, 409],
    [TipoErrorDominio.REGLA_NEGOCIO, 422],
  ])('DomainError %s → %i con su mensaje', (tipo, estado) => {
    expect(capturar(new DomainError(tipo, 'Mensaje propio'))).toEqual({
      estado,
      cuerpo: { success: false, data: null, message: 'Mensaje propio' },
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('SolicitudInvalidaException → 400 con su mensaje', () => {
    expect(capturar(new SolicitudInvalidaException('El id no es válido')).cuerpo).toEqual({
      success: false,
      data: null,
      message: 'El id no es válido',
    });
  });

  it('las excepciones de NestJS cambian su texto en inglés por uno en español', () => {
    expect(capturar(new NotFoundException('Cannot GET /x'))).toEqual({
      estado: 404,
      cuerpo: {
        success: false,
        data: null,
        message: 'La ruta solicitada no existe',
      },
    });
    expect(capturar(new ForbiddenException()).cuerpo).toMatchObject({
      message: 'No tiene permiso para esta acción',
    });
    expect(
      capturar(new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS)).cuerpo,
    ).toMatchObject({
      message: 'Demasiadas peticiones; espere un momento e intente de nuevo',
    });
  });

  it('un 4xx sin texto propio usa un mensaje genérico', () => {
    expect(capturar(new HttpException('I am a teapot', 418))).toEqual({
      estado: 418,
      cuerpo: {
        success: false,
        data: null,
        message: 'La solicitud no se pudo procesar',
      },
    });
  });

  it('un 5xx de NestJS → su estado, mensaje genérico y el detalle al log', () => {
    expect(capturar(new InternalServerErrorException('detalle'))).toEqual({
      estado: 500,
      cuerpo: {
        success: false,
        data: null,
        message: 'Error interno del servidor',
      },
    });
    expect(log).toHaveBeenCalledOnce();
  });

  it('un 503 → mensaje de servicio no disponible', () => {
    expect(capturar(new ServiceUnavailableException())).toEqual({
      estado: 503,
      cuerpo: {
        success: false,
        data: null,
        message: 'El servicio no está disponible en este momento',
      },
    });
  });

  it('un error cualquiera → 500 sin el detalle; el stack va al log', () => {
    const resultado = capturar(new Error('clave=secreta'));
    expect(resultado).toEqual({
      estado: 500,
      cuerpo: {
        success: false,
        data: null,
        message: 'Error interno del servidor',
      },
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('clave=secreta'));
  });

  it('algo que ni siquiera es un Error → 500 y al log', () => {
    expect(capturar('texto suelto').estado).toBe(500);
    expect(log).toHaveBeenCalledWith('texto suelto');
  });

  it('deja el mensaje que vio el usuario para la línea del log de la petición', () => {
    const { locals } = ejecutar(new NotFoundException());
    expect(locals['mensajeUsuario']).toBe('La ruta solicitada no existe');
  });
});
