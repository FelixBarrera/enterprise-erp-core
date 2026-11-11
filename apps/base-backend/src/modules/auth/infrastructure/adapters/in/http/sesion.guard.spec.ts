import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import {
  Publico,
  RequierePermiso,
  SoloSesion,
} from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import { sesionDePeticion } from '../../../../../../shared/infrastructure/http/acceso/sesion-de-peticion.js';
import type { PeticionAutenticada } from '../../../../application/ports/in/autenticar-peticion.port.js';
import { SesionInvalidaError } from '../../../../domain/errors/auth.errors.js';
import { leerTokenBearer, SesionGuard } from './sesion.guard.js';

class Rutas {
  @Publico()
  publica(this: void): void {}

  @SoloSesion()
  comun(this: void): void {}

  @SoloSesion({ conContrasenaTemporal: true })
  conTemporal(this: void): void {}

  @RequierePermiso('ventas.factura.ver')
  conPermiso(this: void): void {}

  sinRegla(this: void): void {}
}

const AUTENTICADA: PeticionAutenticada = {
  sesionId: 'sid',
  esAdministrador: true,
  actor: {
    usuarioId: 'u',
    nombreUsuario: 'ana',
    empresaId: 'e',
    ip: null,
    navegador: null,
    requestId: null,
  },
};

function contexto(metodo: (this: void) => void, peticion: Request): ExecutionContext {
  return {
    getHandler: () => metodo,
    getClass: () => Rutas,
    switchToHttp: () => ({ getRequest: () => peticion }),
  } as unknown as ExecutionContext;
}

const conCabecera = (authorization?: string) =>
  ({ headers: authorization === undefined ? {} : { authorization } }) as Request;

describe('SesionGuard', () => {
  const autenticar = { execute: vi.fn() };
  const guard = new SesionGuard(autenticar);

  beforeEach(() => {
    autenticar.execute.mockReset();
  });

  it('@Publico(): deja pasar sin revisar nada', async () => {
    await expect(guard.canActivate(contexto(Rutas.prototype.publica, conCabecera()))).resolves.toBe(
      true,
    );
    expect(autenticar.execute).not.toHaveBeenCalled();
  });

  it('@SoloSesion(): revisa el token y deja la sesión en la petición', async () => {
    autenticar.execute.mockResolvedValue(AUTENTICADA);
    const peticion = conCabecera('Bearer abc.def');

    await expect(guard.canActivate(contexto(Rutas.prototype.comun, peticion))).resolves.toBe(true);
    expect(autenticar.execute).toHaveBeenCalledWith({
      tokenAcceso: 'abc.def',
      permiteContrasenaTemporal: false,
      permisoRequerido: null,
    });
    expect(sesionDePeticion(peticion)).toBe(AUTENTICADA);
  });

  it('pasa si la ruta permite la contraseña temporal', async () => {
    autenticar.execute.mockResolvedValue(AUTENTICADA);
    await guard.canActivate(contexto(Rutas.prototype.conTemporal, conCabecera()));
    expect(autenticar.execute).toHaveBeenCalledWith({
      tokenAcceso: null,
      permiteContrasenaTemporal: true,
      permisoRequerido: null,
    });
  });

  it('@RequierePermiso(): pide ese permiso y nunca con contraseña temporal', async () => {
    autenticar.execute.mockResolvedValue(AUTENTICADA);
    const peticion = conCabecera('Bearer abc');

    await expect(guard.canActivate(contexto(Rutas.prototype.conPermiso, peticion))).resolves.toBe(
      true,
    );
    expect(autenticar.execute).toHaveBeenCalledWith({
      tokenAcceso: 'abc',
      permiteContrasenaTemporal: false,
      permisoRequerido: 'ventas.factura.ver',
    });
    expect(sesionDePeticion(peticion)).toBe(AUTENTICADA);
  });

  it('el error del caso de uso sale tal cual (el filtro lo traduce a 401 o 403)', async () => {
    autenticar.execute.mockRejectedValue(new SesionInvalidaError());
    await expect(guard.canActivate(contexto(Rutas.prototype.comun, conCabecera()))).rejects.toThrow(
      SesionInvalidaError,
    );
  });

  it('una ruta sin regla nunca pasa (error de programación)', async () => {
    await expect(
      guard.canActivate(contexto(Rutas.prototype.sinRegla, conCabecera())),
    ).rejects.toThrow('La ruta Rutas.sinRegla no tiene exactamente una regla de acceso');
  });
});

describe('leerTokenBearer', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['Bearer   abc  ', 'abc'],
    [undefined, null],
    ['', null],
    ['Bearer', null],
    ['Bearer ', null],
    ['Basic abc', null],
    ['Bearer abc def', null],
  ])('%j → %j', (cabecera, esperado) => {
    expect(leerTokenBearer(conCabecera(cabecera))).toBe(esperado);
  });
});
