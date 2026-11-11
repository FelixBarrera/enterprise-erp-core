import { actorDelSistema, type Actor } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import type { Rol } from '../../domain/entities/rol.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  EscaladaError,
  UltimoAdministradorError,
  UsuarioDeOtraEmpresaError,
  UsuarioInactivoError,
  UsuarioNoEncontradoError,
} from '../../domain/errors/auth.errors.js';
import {
  ConsultarEmpresasDePrueba,
  GeneradorContrasenaDePrueba,
  HasherDePrueba,
  idDePrueba,
  PermisosEnMemoria,
  RolesEnMemoria,
  SesionesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import { AccionesUsuariosUseCase } from './acciones-usuarios.use-case.js';

const E1 = idDePrueba(1);
const E2 = idDePrueba(2);
const E3 = idDePrueba(3);
const AHORA = '2026-07-15T11:00:00-05:00';
const BLOQUEADO_HASTA = new Date('2026-07-15T11:10:00-05:00');

describe('AccionesUsuariosUseCase', () => {
  let roles: RolesEnMemoria;
  let usuarios: UsuariosEnMemoria;
  let permisos: PermisosEnMemoria;
  let sesiones: SesionesEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let generador: GeneradorContrasenaDePrueba;
  let comunes: Set<string>;
  let casoDeUso: AccionesUsuariosUseCase;
  /** Quien opera: administradora de E1, salvo que la prueba diga otra cosa. */
  let quien: Usuario;
  let actor: Actor;
  let administrador: Rol;
  let ana: Usuario;

  /** Le da al usuario un rol en esa empresa con esos permisos. */
  async function rolCon(usuario: Usuario, empresaId: string, ...codigos: string[]): Promise<Rol> {
    const rol = await roles.darRol(usuario.id, empresaId, { nombre: `R${String(codigos.length)}` });
    for (const codigo of codigos) {
      permisos.darPermiso(rol.id, codigo);
    }
    return rol;
  }

  /** Quien opera deja de ser administradora: solo tiene un rol con esos permisos en E1. */
  async function quienSinAdministrador(...codigos: string[]): Promise<void> {
    roles.asignaciones.delete(`${quien.id}:${administrador.id}`);
    await rolCon(quien, E1, ...codigos);
  }

  function armar(): AccionesUsuariosUseCase {
    return new AccionesUsuariosUseCase(
      usuarios,
      roles,
      permisos,
      sesiones,
      new ConsultarEmpresasDePrueba([
        { id: E1, nombre: 'Comercial del Sur', activo: true },
        { id: E2, nombre: 'Valores Zeta', activo: true },
        { id: E3, nombre: 'Cerrada', activo: false },
      ]),
      { ejecutar: (fn) => fn() },
      auditoria,
      new RelojFijo(AHORA),
      { duracionMaximaHoras: 13, inactividadMinutos: 120 },
      new HasherDePrueba(),
      { esComun: (texto) => comunes.has(texto) },
      generador,
      auditoria,
    );
  }

  beforeEach(async () => {
    roles = new RolesEnMemoria();
    usuarios = new UsuariosEnMemoria(roles);
    permisos = new PermisosEnMemoria(roles);
    sesiones = new SesionesEnMemoria();
    auditoria = new AuditoriaEnMemoria();
    generador = new GeneradorContrasenaDePrueba();
    comunes = new Set();
    casoDeUso = armar();
    quien = usuarios.agregar('jefa');
    administrador = await roles.darRol(quien.id, E1, {
      nombre: 'Administrador',
      esAdministrador: true,
    });
    actor = { ...actorDelSistema({ empresaId: E1 }), usuarioId: quien.id, nombreUsuario: 'jefa' };
    ana = usuarios.agregar('ana', {
      intentosFallidos: 2,
      bloqueadoHasta: BLOQUEADO_HASTA,
    });
    await rolCon(ana, E1, 'ventas.factura.crear');
  });

  const motivoDe = async (promesa: Promise<unknown>): Promise<string> => {
    try {
      await promesa;
      return 'sin error';
    } catch (e) {
      return e instanceof EscaladaError ? e.motivo : String(e);
    }
  };

  describe('darContrasenaTemporal', () => {
    it('genera una temporal, la guarda (debe cambiarla), desbloquea y cierra todas sus sesiones', async () => {
      sesiones.agregar({ usuarioId: ana.id, empresaId: E1 });
      sesiones.agregar({ usuarioId: ana.id, empresaId: E2 });
      const dada = await casoDeUso.darContrasenaTemporal(ana.id, actor);

      expect(dada.contrasenaTemporal).toBe('Temporal-Prueba-1');
      expect(dada.usuario).toMatchObject({
        id: ana.id,
        debeCambiarContrasena: true,
        bloqueadoHasta: null,
        sesiones: [],
      });
      const guardada = await usuarios.buscarPorId(ana.id);
      expect(guardada).toMatchObject({
        hashContrasena: 'hash(Temporal-Prueba-1)',
        debeCambiarContrasena: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      });
      expect([...sesiones.filas.values()].map((s) => s.datos().motivoCierre)).toEqual([
        'ADMINISTRADOR',
        'ADMINISTRADOR',
      ]);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.usuario.contrasena_temporal',
        entidad: 'usuario',
        entidadId: ana.id,
        despues: { claveTemporal: true, sesionesCerradas: 2 },
      });
      expect(JSON.stringify(auditoria.eventos)).not.toContain('Temporal-Prueba-1');
    });

    it('si la generada contiene el nombre de una de sus empresas o es común, genera otra', async () => {
      await rolCon(ana, E2);
      await roles.darRol(quien.id, E2, { nombre: 'Administrador', esAdministrador: true });
      generador = new GeneradorContrasenaDePrueba(['xxValoresxx1', 'ComunComun12']);
      comunes.add('comuncomun12');
      casoDeUso = armar();
      const dada = await casoDeUso.darContrasenaTemporal(ana.id, actor);
      expect(dada.contrasenaTemporal).toBe('Temporal-Prueba-3');
      expect(generador.pedidas).toBe(3);
    });

    it('a sí misma: 403 (usa Cambiar contraseña), sin generar nada', async () => {
      expect(await motivoDe(casoDeUso.darContrasenaTemporal(quien.id, actor))).toBe(
        'propia_contrasena',
      );
      expect(generador.pedidas).toBe(0);
    });

    it('desactivado: 422; que no existe o de otra empresa: 404', async () => {
      const beto = usuarios.agregar('beto', { activo: false });
      await rolCon(beto, E1);
      await expect(casoDeUso.darContrasenaTemporal(beto.id, actor)).rejects.toThrow(
        UsuarioInactivoError,
      );
      const otro = usuarios.agregar('otro');
      await rolCon(otro, E2);
      for (const id of [otro.id, idDePrueba(999)]) {
        await expect(casoDeUso.darContrasenaTemporal(id, actor)).rejects.toThrow(
          UsuarioNoEncontradoError,
        );
      }
      expect(usuarios.guardados).toBe(0);
      expect(auditoria.eventos).toEqual([]);
    });

    it('sin ser administradora: con todos los permisos de ella, sí; con uno de menos, no', async () => {
      await quienSinAdministrador('auth.usuario.restablecer');
      expect(await motivoDe(casoDeUso.darContrasenaTemporal(ana.id, actor))).toBe('mas_permisos');
      await quienSinAdministrador('auth.usuario.restablecer', 'ventas.factura.crear');
      await casoDeUso.darContrasenaTemporal(ana.id, actor);
      expect(auditoria.acciones()).toEqual(['auth.usuario.contrasena_temporal']);
    });

    it('a un administrador solo otro administrador', async () => {
      await roles.darRol(ana.id, E1, { nombre: 'Administrador 2', esAdministrador: true });
      await quienSinAdministrador('auth.usuario.restablecer', 'ventas.factura.crear');
      expect(await motivoDe(casoDeUso.darContrasenaTemporal(ana.id, actor))).toBe(
        'administrador_de_otro',
      );
    });

    it('AUTH-D12: si trabaja en otra empresa, hace falta el permiso allí; y su poder allí cuenta', async () => {
      await rolCon(ana, E2, 'contabilidad.asiento.crear');
      await expect(casoDeUso.darContrasenaTemporal(ana.id, actor)).rejects.toThrow(
        UsuarioDeOtraEmpresaError,
      );
      await rolCon(quien, E2, 'auth.usuario.restablecer');
      expect(await motivoDe(casoDeUso.darContrasenaTemporal(ana.id, actor))).toBe('mas_permisos');
      await rolCon(quien, E2, 'contabilidad.asiento.crear');
      await casoDeUso.darContrasenaTemporal(ana.id, actor);
      // Una empresa desactivada no cuenta.
      await rolCon(ana, E3, 'tesoreria.pago.crear');
      await casoDeUso.darContrasenaTemporal(ana.id, actor);
      expect(auditoria.acciones()).toHaveLength(2);
    });
  });

  describe('desbloquear', () => {
    it('quita el bloqueo y los fallos, y lo registra con el antes', async () => {
      const ficha = await casoDeUso.desbloquear(ana.id, actor);
      expect(ficha.bloqueadoHasta).toBeNull();
      expect(await usuarios.buscarPorId(ana.id)).toMatchObject({
        intentosFallidos: 0,
        bloqueadoHasta: null,
      });
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.usuario.desbloquear',
        antes: { bloqueadoHasta: BLOQUEADO_HASTA.toISOString(), intentosFallidos: 2 },
        despues: { bloqueadoHasta: null, intentosFallidos: 0 },
      });
    });

    it('con fallos pero sin bloqueo vigente, también', async () => {
      const beto = usuarios.agregar('beto', {
        intentosFallidos: 3,
        bloqueadoHasta: new Date('2026-07-15T10:00:00-05:00'),
      });
      await rolCon(beto, E1);
      await casoDeUso.desbloquear(beto.id, actor);
      // La bitácora guarda solo lo que cambió: el bloqueo vencido ya era null para ella.
      expect(auditoria.ultimo()?.antes).toEqual({ intentosFallidos: 3 });
    });

    it('sin bloqueo ni fallos: no escribe ni registra', async () => {
      const beto = usuarios.agregar('beto');
      await rolCon(beto, E1);
      await casoDeUso.desbloquear(beto.id, actor);
      expect(usuarios.guardados).toBe(0);
      expect(auditoria.eventos).toEqual([]);
    });

    it('basta el permiso en la empresa activa (sin AUTH-D12), y se puede sobre uno mismo', async () => {
      await rolCon(ana, E2);
      await quienSinAdministrador('auth.usuario.restablecer');
      await casoDeUso.desbloquear(ana.id, actor);
      await casoDeUso.desbloquear(quien.id, actor);
      expect(auditoria.acciones()).toEqual(['auth.usuario.desbloquear']);
    });

    it('de otra empresa: 404', async () => {
      await expect(casoDeUso.desbloquear(idDePrueba(999), actor)).rejects.toThrow(
        UsuarioNoEncontradoError,
      );
    });
  });

  describe('cerrarSesiones', () => {
    it('cierra todas, en todas sus empresas, y lo registra', async () => {
      sesiones.agregar({ usuarioId: ana.id, empresaId: E1 });
      sesiones.agregar({ usuarioId: ana.id, empresaId: E2 });
      const otra = sesiones.agregar({ usuarioId: quien.id, empresaId: E1 });
      expect(await casoDeUso.cerrarSesiones(ana.id, otra.id, actor)).toEqual({
        id: ana.id,
        sesionesCerradas: 2,
      });
      expect(sesiones.filas.get(otra.id)?.estaAbierta()).toBe(true);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.usuario.cerrar_sesiones',
        entidadId: ana.id,
        despues: { sesionesCerradas: 2 },
      });
    });

    it('sobre uno mismo, deja la actual', async () => {
      const actual = sesiones.agregar({ usuarioId: quien.id, empresaId: E1 });
      sesiones.agregar({ usuarioId: quien.id, empresaId: E1 });
      expect(await casoDeUso.cerrarSesiones(quien.id, actual.id, actor)).toEqual({
        id: quien.id,
        sesionesCerradas: 1,
      });
      expect(sesiones.filas.get(actual.id)?.estaAbierta()).toBe(true);
    });

    it('sin sesiones abiertas: no registra', async () => {
      expect((await casoDeUso.cerrarSesiones(ana.id, 'x', actor)).sesionesCerradas).toBe(0);
      expect(auditoria.eventos).toEqual([]);
    });
  });

  describe('desactivar', () => {
    it('lo desactiva, cierra sus sesiones y lo registra', async () => {
      sesiones.agregar({ usuarioId: ana.id, empresaId: E1 });
      const ficha = await casoDeUso.desactivar(ana.id, actor);
      expect(ficha.activo).toBe(false);
      expect((await usuarios.buscarPorId(ana.id))?.activo).toBe(false);
      expect([...sesiones.filas.values()][0]?.datos().motivoCierre).toBe('USUARIO_DESACTIVADO');
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.usuario.desactivar',
        antes: { activo: true },
        despues: { activo: false, sesionesCerradas: 1 },
      });
    });

    it('ya desactivado: no escribe ni registra', async () => {
      const beto = usuarios.agregar('beto', { activo: false });
      await rolCon(beto, E1);
      await casoDeUso.desactivar(beto.id, actor);
      expect(usuarios.guardados).toBe(0);
      expect(auditoria.eventos).toEqual([]);
    });

    it('a sí misma: 403', async () => {
      expect(await motivoDe(casoDeUso.desactivar(quien.id, actor))).toBe('desactivarse');
    });

    it('sin ser administradora: a uno con más permisos, sí (quitar no da poder); a un administrador, no', async () => {
      await quienSinAdministrador('auth.usuario.desactivar');
      await casoDeUso.desactivar(ana.id, actor);
      const beto = usuarios.agregar('beto');
      await roles.darRol(beto.id, E1, { nombre: 'Administrador 2', esAdministrador: true });
      expect(await motivoDe(casoDeUso.desactivar(beto.id, actor))).toBe('administrador_de_otro');
    });

    it('AUTH-D11 (4): bloquea el rol Administrador de cada empresa donde lo es y cuenta', async () => {
      const beto = usuarios.agregar('beto');
      roles.asignaciones.add(`${beto.id}:${administrador.id}`);
      const bloqueados: string[] = [];
      const buscar = roles.buscarParaActualizar.bind(roles);
      roles.buscarParaActualizar = (id, empresaId) => {
        bloqueados.push(id);
        return buscar(id, empresaId);
      };
      await casoDeUso.desactivar(beto.id, actor);
      expect(bloqueados).toEqual([administrador.id]);
      expect(auditoria.acciones()).toEqual(['auth.usuario.desactivar']);
    });

    it('AUTH-D11 (4): si al contar no queda otro (dos a la vez), 422 y no escribe', async () => {
      const beto = usuarios.agregar('beto');
      roles.asignaciones.add(`${beto.id}:${administrador.id}`);
      // Con una sola petición no pasa (quien opera es otra administradora activa): se simula
      // que la otra se desactivó a la vez.
      roles.contarUsuarios = () => Promise.resolve(1);
      await expect(casoDeUso.desactivar(beto.id, actor)).rejects.toThrow(UltimoAdministradorError);
      expect(usuarios.guardados).toBe(0);
      expect(auditoria.eventos).toEqual([]);
    });

    it('AUTH-D12: con el permiso solo aquí y otra empresa suya, 403', async () => {
      await rolCon(ana, E2);
      await expect(casoDeUso.desactivar(ana.id, actor)).rejects.toThrow(UsuarioDeOtraEmpresaError);
    });
  });

  describe('reactivar', () => {
    let beto: Usuario;

    beforeEach(async () => {
      beto = usuarios.agregar('beto', { activo: false });
      await rolCon(beto, E1, 'ventas.factura.crear');
    });

    it('lo reactiva y lo registra', async () => {
      const ficha = await casoDeUso.reactivar(beto.id, actor);
      expect(ficha.activo).toBe(true);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.usuario.reactivar',
        antes: { activo: false },
        despues: { activo: true },
      });
    });

    it('ya activo: no escribe ni registra', async () => {
      await casoDeUso.reactivar(ana.id, actor);
      expect(usuarios.guardados).toBe(0);
      expect(auditoria.eventos).toEqual([]);
    });

    it('sin ser administradora: hace falta tener todos sus permisos (le devuelve su poder)', async () => {
      await quienSinAdministrador('auth.usuario.desactivar');
      expect(await motivoDe(casoDeUso.reactivar(beto.id, actor))).toBe('mas_permisos');
      await quienSinAdministrador('auth.usuario.desactivar', 'ventas.factura.crear');
      await casoDeUso.reactivar(beto.id, actor);
      expect(auditoria.acciones()).toEqual(['auth.usuario.reactivar']);
    });

    it('AUTH-D12: con el permiso solo aquí y otra empresa suya, 403', async () => {
      await rolCon(beto, E2);
      await expect(casoDeUso.reactivar(beto.id, actor)).rejects.toThrow(UsuarioDeOtraEmpresaError);
    });
  });

  it('sin empresa activa: 404 en todas', async () => {
    const sin = { ...actor, empresaId: null };
    for (const accion of [
      casoDeUso.darContrasenaTemporal(ana.id, sin),
      casoDeUso.desbloquear(ana.id, sin),
      casoDeUso.cerrarSesiones(ana.id, 'x', sin),
      casoDeUso.desactivar(ana.id, sin),
      casoDeUso.reactivar(ana.id, sin),
    ]) {
      await expect(accion).rejects.toThrow(UsuarioNoEncontradoError);
    }
  });
});
