import type { Request, Response } from 'express';
import type { SesionDePeticion } from '../../../../../../shared/infrastructure/http/acceso/sesion-de-peticion.js';
import type { TokensSesion } from '../../../../application/ports/in/iniciar-sesion.port.js';
import {
  CredencialesInvalidasError,
  SesionInvalidaError,
} from '../../../../domain/errors/auth.errors.js';
import { AuthController } from './auth.controller.js';
import {
  COOKIE_REFRESCO,
  leerCookieRefresco,
  OPCIONES_COOKIE_REFRESCO,
} from './cookie-refresco.js';

const TOKENS: TokensSesion = {
  tokenAcceso: 'jwt',
  expiraEnSegundos: 900,
  tokenRefresco: 'sid.secreto',
  sesionVenceEn: new Date('2026-07-16T02:00:00Z'),
  debeCambiarContrasena: false,
};

function respuestaFalsa() {
  return { cookie: vi.fn(), clearCookie: vi.fn() };
}

const peticion = (cookies: unknown) => ({ cookies }) as unknown as Request;

describe('AuthController', () => {
  const iniciar = { execute: vi.fn() };
  const renovar = { execute: vi.fn() };
  const consultar = { execute: vi.fn() };
  const cerrar = { execute: vi.fn() };
  const cambiarEmpresa = { execute: vi.fn() };
  const cambiarContrasena = { execute: vi.fn() };
  const controller = new AuthController(
    iniciar,
    renovar,
    consultar,
    cerrar,
    cambiarEmpresa,
    cambiarContrasena,
  );

  beforeEach(() => {
    iniciar.execute.mockReset();
    renovar.execute.mockReset();
    consultar.execute.mockReset();
    cerrar.execute.mockReset();
    cambiarEmpresa.execute.mockReset();
    cambiarContrasena.execute.mockReset();
  });

  const SESION: SesionDePeticion = {
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

  it('logout: cierra esta sesión con el actor y borra la cookie', async () => {
    cerrar.execute.mockResolvedValue(undefined);
    const res = respuestaFalsa();

    await expect(controller.logout(SESION, res as unknown as Response)).resolves.toEqual({
      success: true,
      data: null,
      message: 'Sesión cerrada',
    });
    expect(cerrar.execute).toHaveBeenCalledWith('sid', SESION.actor);
    expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_REFRESCO, OPCIONES_COOKIE_REFRESCO);
  });

  it('sesion: pasa al caso de uso lo que dejó el guard', async () => {
    consultar.execute.mockResolvedValue({ zonaNegocio: 'America/Guayaquil' });

    await expect(controller.sesion(SESION)).resolves.toMatchObject({
      data: { zonaNegocio: 'America/Guayaquil' },
      message: 'Sesión',
    });
    expect(consultar.execute).toHaveBeenCalledWith({
      sesionId: 'sid',
      usuarioId: 'u',
      empresaId: 'e',
      esAdministrador: true,
    });
  });

  it('empresa: pasa la sesión, el usuario y la empresa pedida, con el actor', async () => {
    cambiarEmpresa.execute.mockResolvedValue({ empresaActiva: { id: 'e2', nombre: 'Otra' } });

    await expect(controller.empresa({ empresaId: 'e2' }, SESION)).resolves.toMatchObject({
      data: { empresaActiva: { id: 'e2' } },
      message: 'Empresa cambiada',
    });
    expect(cambiarEmpresa.execute).toHaveBeenCalledWith(
      { sesionId: 'sid', usuarioId: 'u', empresaId: 'e2' },
      SESION.actor,
    );
  });

  it('cambiar-contrasena: pasa las dos contraseñas y responde sin datos', async () => {
    cambiarContrasena.execute.mockResolvedValue(undefined);

    await expect(
      controller.contrasena({ contrasenaActual: 'vieja', contrasenaNueva: 'nueva' }, SESION),
    ).resolves.toEqual({ success: true, data: null, message: 'Contraseña cambiada' });
    expect(cambiarContrasena.execute).toHaveBeenCalledWith(
      { sesionId: 'sid', usuarioId: 'u', contrasenaActual: 'vieja', contrasenaNueva: 'nueva' },
      SESION.actor,
    );
  });

  it('login: el refresh token va solo en la cookie, que vence con la sesión', async () => {
    iniciar.execute.mockResolvedValue(TOKENS);
    const res = respuestaFalsa();

    const cuerpo = await controller.login(
      { nombreUsuario: 'ana', contrasena: 'x' },
      res as unknown as Response,
    );

    expect(cuerpo).toEqual({
      success: true,
      data: { tokenAcceso: 'jwt', expiraEnSegundos: 900, debeCambiarContrasena: false },
      message: 'Sesión iniciada',
    });
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_REFRESCO, 'sid.secreto', {
      ...OPCIONES_COOKIE_REFRESCO,
      expires: TOKENS.sesionVenceEn,
    });
  });

  it('refresh: lee la cookie y pone la nueva', async () => {
    renovar.execute.mockResolvedValue(TOKENS);
    const res = respuestaFalsa();

    const cuerpo = await controller.refresh(
      peticion({ [COOKIE_REFRESCO]: 'viejo' }),
      res as unknown as Response,
    );

    expect(renovar.execute).toHaveBeenCalledWith('viejo');
    expect(cuerpo.message).toBe('Sesión renovada');
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('refresh con sesión inválida: borra la cookie y deja pasar el error', async () => {
    renovar.execute.mockRejectedValue(new SesionInvalidaError());
    const res = respuestaFalsa();

    await expect(controller.refresh(peticion({}), res as unknown as Response)).rejects.toThrow(
      SesionInvalidaError,
    );
    expect(renovar.execute).toHaveBeenCalledWith(null);
    expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_REFRESCO, OPCIONES_COOKIE_REFRESCO);
  });

  it('refresh con otro error: no toca la cookie', async () => {
    renovar.execute.mockRejectedValue(new CredencialesInvalidasError());
    const res = respuestaFalsa();

    await expect(controller.refresh(peticion({}), res as unknown as Response)).rejects.toThrow(
      CredencialesInvalidasError,
    );
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});

describe('leerCookieRefresco', () => {
  it.each([
    ['sin cookies (cookie-parser no corrió)', undefined, null],
    ['otras cookies', { otra: 'x' }, null],
    ['vacía', { [COOKIE_REFRESCO]: '' }, null],
    ['repetida (llega como lista)', { [COOKIE_REFRESCO]: ['a', 'b'] }, null],
    ['con valor', { [COOKIE_REFRESCO]: 'sid.secreto' }, 'sid.secreto'],
  ])('%s', (_caso, cookies, esperado) => {
    expect(leerCookieRefresco(peticion(cookies))).toBe(esperado);
  });

  it('la cookie solo viaja a /api/v1/auth, httpOnly, Secure y SameSite=Strict', () => {
    expect(OPCIONES_COOKIE_REFRESCO).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/v1/auth',
    });
  });
});
