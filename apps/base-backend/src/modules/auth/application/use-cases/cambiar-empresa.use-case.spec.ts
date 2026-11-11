import { actorDelSistema } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import type { Sesion } from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import { SesionInvalidaError, SinAccesoEmpresaError } from '../../domain/errors/auth.errors.js';
import {
  ConsultarEmpresasDePrueba,
  idDePrueba,
  PermisosEnMemoria,
  RolesEnMemoria,
  SesionesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import { CambiarEmpresaUseCase } from './cambiar-empresa.use-case.js';
import { ConsultarSesionUseCase } from './consultar-sesion.use-case.js';

const ALFA = { id: idDePrueba(1), nombre: 'Alfa Comercial', activo: true };
const BETA = { id: idDePrueba(2), nombre: 'Beta Servicios', activo: true };
const GAMA = { id: idDePrueba(3), nombre: 'Gama (desactivada)', activo: false };
const DELTA = { id: idDePrueba(4), nombre: 'Delta (sin rol)', activo: true };

describe('CambiarEmpresaUseCase', () => {
  let usuarios: UsuariosEnMemoria;
  let roles: RolesEnMemoria;
  let sesiones: SesionesEnMemoria;
  let permisos: PermisosEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let casoDeUso: CambiarEmpresaUseCase;
  let usuario: Usuario;
  let sesion: Sesion;

  beforeEach(async () => {
    usuarios = new UsuariosEnMemoria();
    roles = new RolesEnMemoria();
    sesiones = new SesionesEnMemoria();
    auditoria = new AuditoriaEnMemoria(new RelojFijo('2026-07-15T09:00:00-05:00'));
    const empresas = new ConsultarEmpresasDePrueba([ALFA, BETA, GAMA, DELTA]);
    permisos = new PermisosEnMemoria(roles);
    casoDeUso = new CambiarEmpresaUseCase(
      sesiones,
      usuarios,
      roles,
      empresas,
      new ConsultarSesionUseCase(sesiones, usuarios, roles, empresas, permisos),
      { ejecutar: (fn) => fn() },
      auditoria,
    );
    usuario = usuarios.agregar('ana', { ultimaEmpresaId: ALFA.id });
    await roles.darRol(usuario.id, ALFA.id, { esAdministrador: true, nombre: 'Administrador' });
    const operador = await roles.darRol(usuario.id, BETA.id);
    permisos.agregar('auth.rol.ver');
    permisos.darPermiso(operador.id, 'auth.usuario.ver');
    await roles.darRol(usuario.id, GAMA.id);
    await roles.darRol(usuario.id, DELTA.id, { activo: false });
    sesion = sesiones.agregar({ usuarioId: usuario.id, empresaId: ALFA.id });
  });

  const actor = () => ({
    ...actorDelSistema({ empresaId: ALFA.id }),
    usuarioId: usuario.id,
    nombreUsuario: 'ana',
  });
  const cambiar = (empresaId: string) =>
    casoDeUso.execute({ sesionId: sesion.id, usuarioId: usuario.id, empresaId }, actor());

  it('pasa la sesión a la otra empresa, la deja como última usada y lo registra en la nueva', async () => {
    const vista = await cambiar(BETA.id);

    expect(sesiones.filas.get(sesion.id)?.empresaId).toBe(BETA.id);
    expect((await usuarios.buscarPorId(usuario.id))?.ultimaEmpresaId).toBe(BETA.id);
    expect(auditoria.acciones()).toEqual(['auth.sesion.cambiar_empresa']);
    expect(auditoria.ultimo()).toMatchObject({
      entidad: 'sesion',
      entidadId: sesion.id,
      empresaId: BETA.id,
      usuarioId: usuario.id,
    });
    expect(JSON.stringify(auditoria.ultimo())).toContain(ALFA.id);
    // La vista ya es de la empresa nueva, y allí no es administrador.
    expect(vista.empresaActiva).toEqual({ id: BETA.id, nombre: BETA.nombre });
    expect(vista.esAdministrador).toBe(false);
    expect(vista.permisos).toEqual(['auth.usuario.ver']);
  });

  it('volver a la empresa donde es administrador lo dice en la vista', async () => {
    await cambiar(BETA.id);
    const vista = await cambiar(ALFA.id);
    expect(vista.esAdministrador).toBe(true);
    expect(vista.permisos).toEqual(['auth.rol.ver', 'auth.usuario.ver']);
    expect(auditoria.acciones()).toHaveLength(2);
  });

  it('a la misma empresa: no cambia nada ni registra, y responde la sesión', async () => {
    const vista = await cambiar(ALFA.id);
    expect(vista.empresaActiva.id).toBe(ALFA.id);
    expect(auditoria.acciones()).toEqual([]);
  });

  it.each([
    ['desactivada', GAMA.id],
    ['con el rol desactivado', DELTA.id],
    ['que no existe', idDePrueba(99)],
  ])('a una empresa %s: SinAccesoEmpresaError, sin cambios', async (_caso, empresaId) => {
    await expect(cambiar(empresaId)).rejects.toBeInstanceOf(SinAccesoEmpresaError);
    expect(sesiones.filas.get(sesion.id)?.empresaId).toBe(ALFA.id);
    expect(auditoria.acciones()).toEqual([]);
  });

  it('con la sesión cerrada en este mismo instante: SesionInvalidaError', async () => {
    await sesiones.guardar(sesion.cerrar('SALIDA', new Date('2026-07-15T09:00:00-05:00')));
    await expect(cambiar(BETA.id)).rejects.toBeInstanceOf(SesionInvalidaError);
    expect(auditoria.acciones()).toEqual([]);
  });
});
