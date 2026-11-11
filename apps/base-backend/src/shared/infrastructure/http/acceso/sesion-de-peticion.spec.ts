import type { Request } from 'express';
import { actorDelSistema } from '../../../application/actor.js';
import {
  guardarSesionDePeticion,
  type SesionDePeticion,
  sesionDePeticion,
  sesionDePeticionSiHay,
} from './sesion-de-peticion.js';

const SESION: SesionDePeticion = {
  sesionId: 'sid',
  esAdministrador: false,
  actor: {
    ...actorDelSistema({ empresaId: 'empresa' }),
    usuarioId: 'usuario',
    empresaId: 'empresa',
  },
};

describe('Sesión de la petición', () => {
  it('cada petición tiene la suya', () => {
    const una = {} as Request;
    const otra = {} as Request;
    guardarSesionDePeticion(una, SESION);

    expect(sesionDePeticion(una)).toBe(SESION);
    expect(() => sesionDePeticion(otra)).toThrow(/no tiene @SoloSesion/);
  });

  it('sesionDePeticionSiHay(): la sesión o null, sin error', () => {
    const con = {} as Request;
    guardarSesionDePeticion(con, SESION);

    expect(sesionDePeticionSiHay(con)).toBe(SESION);
    expect(sesionDePeticionSiHay({} as Request)).toBeNull();
  });
});
