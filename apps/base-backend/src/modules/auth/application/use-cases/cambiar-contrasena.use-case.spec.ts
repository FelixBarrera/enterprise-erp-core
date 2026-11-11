import { actorDelSistema } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import { MotivoCierreSesion, type Sesion } from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  ContrasenaActualIncorrectaError,
  ContrasenaDebilError,
  CuentaBloqueadaError,
  SesionInvalidaError,
} from '../../domain/errors/auth.errors.js';
import {
  ConsultarEmpresasDePrueba,
  HasherDePrueba,
  idDePrueba,
  RolesEnMemoria,
  SesionesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import {
  CambiarContrasenaUseCase,
  MENSAJE_CONTRASENA_REPETIDA,
} from './cambiar-contrasena.use-case.js';

const ALFA = { id: idDePrueba(1), nombre: 'Alfa Comercial', activo: true };
const ACTUAL = 'Margarita-Lunes-47';
const NUEVA = 'Girasol-Martes-83';

describe('CambiarContrasenaUseCase', () => {
  let reloj: RelojFijo;
  let usuarios: UsuariosEnMemoria;
  let sesiones: SesionesEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let casoDeUso: CambiarContrasenaUseCase;
  let usuario: Usuario;
  let esta: Sesion;
  let otra: Sesion;

  beforeEach(async () => {
    reloj = new RelojFijo('2026-07-15T09:00:00-05:00');
    usuarios = new UsuariosEnMemoria();
    const roles = new RolesEnMemoria();
    sesiones = new SesionesEnMemoria();
    auditoria = new AuditoriaEnMemoria(reloj);
    casoDeUso = new CambiarContrasenaUseCase(
      usuarios,
      sesiones,
      roles,
      new ConsultarEmpresasDePrueba([ALFA]),
      new HasherDePrueba(),
      { esComun: (texto) => texto === 'contrasena123' },
      reloj,
      { ejecutar: (fn) => fn() },
      auditoria,
    );
    usuario = usuarios.agregar('ana', {
      hashContrasena: `hash(${ACTUAL})`,
      debeCambiarContrasena: true,
      intentosFallidos: 2,
    });
    await roles.darRol(usuario.id, ALFA.id);
    esta = sesiones.agregar({ usuarioId: usuario.id, empresaId: ALFA.id });
    otra = sesiones.agregar({ usuarioId: usuario.id, empresaId: ALFA.id });
  });

  const actor = () => ({
    ...actorDelSistema({ empresaId: ALFA.id }),
    usuarioId: usuario.id,
    nombreUsuario: 'ana',
  });
  const cambiar = (contrasenaActual: string, contrasenaNueva: string) =>
    casoDeUso.execute(
      { sesionId: esta.id, usuarioId: usuario.id, contrasenaActual, contrasenaNueva },
      actor(),
    );
  const guardado = async () => (await usuarios.buscarPorId(usuario.id)) as Usuario;

  it('guarda el hash nuevo, quita la temporal y los fallos, y cierra solo las otras sesiones', async () => {
    await cambiar(ACTUAL, NUEVA);

    expect(await guardado()).toMatchObject({
      hashContrasena: `hash(${NUEVA})`,
      debeCambiarContrasena: false,
      intentosFallidos: 0,
    });
    expect(sesiones.filas.get(esta.id)?.estaAbierta()).toBe(true);
    expect(sesiones.filas.get(otra.id)?.datos().motivoCierre).toBe(
      MotivoCierreSesion.CAMBIO_CONTRASENA,
    );
    expect(auditoria.acciones()).toEqual(['auth.usuario.cambiar_contrasena']);
    const evento = JSON.stringify(auditoria.ultimo());
    expect(evento).toContain('"sesionesCerradas":1');
    // Ni la contraseña ni el hash van a la bitácora.
    expect(evento).not.toContain(NUEVA);
    expect(evento).not.toContain('hash(');
  });

  it('actual incorrecta: suma un fallo (confirmado), lo registra y no cambia nada más', async () => {
    await expect(cambiar('otra-cosa-1', NUEVA)).rejects.toBeInstanceOf(
      ContrasenaActualIncorrectaError,
    );
    expect(await guardado()).toMatchObject({
      hashContrasena: `hash(${ACTUAL})`,
      intentosFallidos: 3,
    });
    expect(sesiones.filas.get(otra.id)?.estaAbierta()).toBe(true);
    expect(auditoria.acciones()).toEqual(['auth.usuario.cambiar_contrasena_fallido']);
  });

  it('al quinto fallo bloquea; bloqueada, ni con la correcta se puede hasta que pase', async () => {
    await expect(cambiar('mal-1', NUEVA)).rejects.toBeInstanceOf(ContrasenaActualIncorrectaError);
    await expect(cambiar('mal-2', NUEVA)).rejects.toBeInstanceOf(ContrasenaActualIncorrectaError);
    await expect(cambiar('mal-3', NUEVA)).rejects.toBeInstanceOf(ContrasenaActualIncorrectaError);
    expect(auditoria.acciones().at(-1)).toBe('auth.usuario.bloquear');
    expect((await guardado()).estaBloqueado(reloj.ahora())).toBe(true);

    await expect(cambiar(ACTUAL, NUEVA)).rejects.toBeInstanceOf(CuentaBloqueadaError);
    expect((await guardado()).hashContrasena).toBe(`hash(${ACTUAL})`);

    reloj.avanzarMinutos(15);
    await cambiar(ACTUAL, NUEVA);
    expect((await guardado()).hashContrasena).toBe(`hash(${NUEVA})`);
  });

  it('la nueva igual a la actual: ContrasenaDebilError, sin cambios', async () => {
    await expect(cambiar(ACTUAL, ACTUAL)).rejects.toThrow(MENSAJE_CONTRASENA_REPETIDA);
    expect(auditoria.acciones()).toEqual([]);
  });

  it.each([
    ['corta', 'abc'],
    ['común', 'contrasena123'],
    ['con el usuario', 'ana-y-sus-cosas'],
    ['con la empresa', 'comercial-2026!'],
  ])('la nueva %s: ContrasenaDebilError, sin cambios', async (_caso, nueva) => {
    await expect(cambiar(ACTUAL, nueva)).rejects.toBeInstanceOf(ContrasenaDebilError);
    expect((await guardado()).hashContrasena).toBe(`hash(${ACTUAL})`);
    expect(auditoria.acciones()).toEqual([]);
  });

  it('si el usuario ya no existe: SesionInvalidaError', async () => {
    usuarios.filas.clear();
    await expect(cambiar(ACTUAL, NUEVA)).rejects.toBeInstanceOf(SesionInvalidaError);
  });
});
