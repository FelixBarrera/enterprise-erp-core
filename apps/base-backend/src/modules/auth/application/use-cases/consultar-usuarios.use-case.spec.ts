import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import { actorDelSistema } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { UsuarioNoEncontradoError } from '../../domain/errors/auth.errors.js';
import {
  ConsultarEmpresasDePrueba,
  idDePrueba,
  PermisosEnMemoria,
  RolesEnMemoria,
  SesionesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import { ConsultarUsuariosUseCase } from './consultar-usuarios.use-case.js';

const E1 = idDePrueba(1);
const E2 = idDePrueba(2);
const E3 = idDePrueba(3);
const actor = actorDelSistema({ empresaId: E1 });
const PRIMERA = { pagina: 1, tamano: 20 };
const AHORA = '2026-07-15T11:00:00-05:00';
const ahora = new Date(AHORA);
const minutos = (n: number) => new Date(ahora.getTime() + n * 60_000);

describe('ConsultarUsuariosUseCase', () => {
  let roles: RolesEnMemoria;
  let usuarios: UsuariosEnMemoria;
  let sesiones: SesionesEnMemoria;
  let empresas: ConsultarEmpresasDePrueba;
  let auditoria: AuditoriaEnMemoria;
  let permisos: PermisosEnMemoria;
  let casoDeUso: ConsultarUsuariosUseCase;

  beforeEach(() => {
    auditoria = new AuditoriaEnMemoria(new RelojFijo(AHORA));
    roles = new RolesEnMemoria();
    usuarios = new UsuariosEnMemoria(roles);
    permisos = new PermisosEnMemoria(roles);
    sesiones = new SesionesEnMemoria();
    empresas = new ConsultarEmpresasDePrueba([
      { id: E1, nombre: 'Sur', activo: true },
      { id: E2, nombre: 'Zeta', activo: true },
      { id: E3, nombre: 'Cerrada', activo: false },
    ]);
    casoDeUso = new ConsultarUsuariosUseCase(
      usuarios,
      roles,
      sesiones,
      empresas,
      new RelojFijo(AHORA),
      { duracionMaximaHoras: 13, inactividadMinutos: 120 },
      auditoria,
      permisos,
    );
  });

  describe('listar', () => {
    it('solo los de su empresa (con algún rol, activo o no), por nombre sin tildes, con sus roles', async () => {
      const zoe = usuarios.agregar('zoe', { nombreCompleto: 'Zoe Ruiz' });
      const alvaro = usuarios.agregar('alvaro', {
        nombreCompleto: 'Álvaro Mora',
        bloqueadoHasta: minutos(10),
        ultimoIngresoEn: minutos(-60),
        debeCambiarContrasena: true,
      });
      const beto = usuarios.agregar('beto', {
        nombreCompleto: 'Beto',
        bloqueadoHasta: minutos(-1),
      });
      usuarios.agregar('sinrol');
      const caja = await roles.darRol(zoe.id, E1, { nombre: 'Caja' });
      await roles.darRol(alvaro.id, E1, { nombre: 'Viejo', activo: false });
      await roles.asignar(alvaro.id, caja);
      await roles.darRol(beto.id, E2, { nombre: 'De Zeta' });

      const pagina = await casoDeUso.listar({}, PRIMERA, actor);
      expect(pagina).toMatchObject({ total: 2, pagina: 1, tamano: 20 });
      expect(pagina.elementos.map((u) => u.nombreUsuario)).toEqual(['alvaro', 'zoe']);
      expect(pagina.elementos[0]).toEqual({
        id: alvaro.id,
        nombreUsuario: 'alvaro',
        nombreCompleto: 'Álvaro Mora',
        activo: true,
        bloqueadoHasta: minutos(10),
        ultimoIngresoEn: minutos(-60),
        debeCambiarContrasena: true,
        roles: [
          { id: caja.id, nombre: 'Caja', esAdministrador: false, activo: true },
          expect.objectContaining({ nombre: 'Viejo', activo: false }),
        ],
      });

      // Un bloqueo que ya pasó no se muestra.
      const deZeta = await casoDeUso.listar({}, PRIMERA, actorDelSistema({ empresaId: E2 }));
      expect(deZeta.elementos[0]?.bloqueadoHasta).toBeNull();
      expect(pagina.elementos[1]?.debeCambiarContrasena).toBe(false);
    });

    it('filtros (texto en el nombre o el usuario, activo, rol) y páginas', async () => {
      const ana = usuarios.agregar('ana.p', { nombreCompleto: 'Ana Pérez' });
      const luis = usuarios.agregar('luis', { nombreCompleto: 'Luis', activo: false });
      const caja = await roles.darRol(ana.id, E1, { nombre: 'Caja' });
      await roles.darRol(luis.id, E1, { nombre: 'Otro' });
      const nombres = async (filtros: Parameters<typeof casoDeUso.listar>[0]) =>
        (await casoDeUso.listar(filtros, PRIMERA, actor)).elementos.map((u) => u.nombreUsuario);
      expect(await nombres({ texto: ' PEREZ ' })).toEqual(['ana.p']);
      expect(await nombres({ texto: 'ana.' })).toEqual(['ana.p']);
      expect(await nombres({ activo: false })).toEqual(['luis']);
      expect(await nombres({ rolId: caja.id })).toEqual(['ana.p']);
      const segunda = await casoDeUso.listar({}, { pagina: 2, tamano: 1 }, actor);
      expect(segunda).toMatchObject({ total: 2, pagina: 2 });
      expect(segunda.elementos.map((u) => u.nombreUsuario)).toEqual(['luis']);
    });

    it('sin empresa activa: 404', async () => {
      await expect(casoDeUso.listar({}, PRIMERA, actorDelSistema({}))).rejects.toThrow(
        UsuarioNoEncontradoError,
      );
    });
  });

  describe('ver', () => {
    it('la ficha: datos, roles de esta empresa y solo sus sesiones vivas en ella', async () => {
      const ana = usuarios.agregar('ana', {
        nombreCompleto: 'Ana',
        debeCambiarContrasena: true,
        bloqueadoHasta: minutos(5),
      });
      await roles.darRol(ana.id, E1, { nombre: 'Caja' });
      await roles.darRol(ana.id, E2, { nombre: 'De Zeta' });
      const viva = sesiones.agregar({
        usuarioId: ana.id,
        empresaId: E1,
        iniciadaEn: minutos(-30),
        ip: '10.0.0.1',
        navegador: 'Firefox',
      });
      const masNueva = sesiones.agregar({
        usuarioId: ana.id,
        empresaId: E1,
        iniciadaEn: minutos(-5),
      });
      // Sin uso hace más de 120 minutos, cerrada y de otra empresa: no salen.
      sesiones.agregar({ usuarioId: ana.id, empresaId: E1, iniciadaEn: minutos(-200) });
      sesiones.agregar({
        usuarioId: ana.id,
        empresaId: E1,
        iniciadaEn: minutos(-10),
        cerradaEn: minutos(-1),
        motivoCierre: 'SALIDA',
      });
      sesiones.agregar({ usuarioId: ana.id, empresaId: E2, iniciadaEn: minutos(-10) });

      const ficha = await casoDeUso.ver(ana.id, actor);
      expect(ficha).toEqual({
        id: ana.id,
        nombreUsuario: 'ana',
        nombreCompleto: 'Ana',
        activo: true,
        bloqueadoHasta: minutos(5),
        ultimoIngresoEn: null,
        roles: [expect.objectContaining({ nombre: 'Caja' })],
        debeCambiarContrasena: true,
        trabajaEnOtrasEmpresas: true,
        sesiones: [
          {
            id: masNueva.id,
            iniciadaEn: minutos(-5),
            ultimoUsoEn: minutos(-5),
            ip: null,
            navegador: null,
          },
          {
            id: viva.id,
            iniciadaEn: minutos(-30),
            ultimoUsoEn: minutos(-30),
            ip: '10.0.0.1',
            navegador: 'Firefox',
          },
        ],
        creado: null,
        modificado: null,
      });
    });

    it('el pie sale de la bitácora de esta empresa: alta y último cambio, sin los ingresos', async () => {
      const ana = usuarios.agregar('ana');
      await roles.darRol(ana.id, E1);
      const quien = (nombreUsuario: string, empresaId = E1) =>
        actorDelSistema({ nombreUsuario, empresaId });
      const evento = (accion: string) => ({
        accion,
        entidad: 'usuario',
        entidadId: ana.id,
        despues: { nombreCompleto: accion },
      });
      await auditoria.registrar(evento('auth.usuario.crear'), quien('jefe', E2));
      await auditoria.registrar(evento('auth.usuario.dar_acceso'), quien('admin'));
      await auditoria.registrar(evento('auth.usuario.editar'), quien('admin'));
      await auditoria.registrar(evento('auth.usuario.editar'), quien('jefe', E2));
      await auditoria.registrar(evento('auth.sesion.fallido'), quien('ana'));
      await auditoria.registrar(
        evento('auth.usuario.bloquear'),
        actorDelSistema({ empresaId: E1 }),
      );

      const ficha = await casoDeUso.ver(ana.id, actor);
      expect(ficha.creado).toEqual({ en: ahora, por: 'admin' });
      expect(ficha.modificado).toEqual({ en: ahora, por: 'admin' });

      await auditoria.registrar(evento('auth.usuario.cambiar_contrasena'), quien('ana'));
      expect((await casoDeUso.ver(ana.id, actor)).modificado?.por).toBe('ana');
    });

    it('trabajaEnOtrasEmpresas: una empresa desactivada no cuenta; un rol desactivado sí', async () => {
      const ana = usuarios.agregar('ana');
      await roles.darRol(ana.id, E1);
      await roles.darRol(ana.id, E3);
      expect((await casoDeUso.ver(ana.id, actor)).trabajaEnOtrasEmpresas).toBe(false);
      await roles.darRol(ana.id, E2, { activo: false });
      expect((await casoDeUso.ver(ana.id, actor)).trabajaEnOtrasEmpresas).toBe(true);
    });

    it('uno que no existe, sin roles en esta empresa, o sin empresa activa: 404', async () => {
      const deZeta = usuarios.agregar('beto');
      await roles.darRol(deZeta.id, E2);
      await expect(casoDeUso.ver(idDePrueba(999), actor)).rejects.toThrow('El usuario no existe');
      await expect(casoDeUso.ver(deZeta.id, actor)).rejects.toThrow(UsuarioNoEncontradoError);
      await expect(casoDeUso.ver(deZeta.id, actorDelSistema({}))).rejects.toThrow(
        UsuarioNoEncontradoError,
      );
    });
  });

  describe('rolesAsignables (6.12b0)', () => {
    /** Una jefa (no administradora) con dos permisos, y los roles de la empresa. */
    async function preparar() {
      const jefa = usuarios.agregar('jefa');
      const suyo = await roles.darRol(jefa.id, E1, { nombre: 'Jefatura' });
      permisos.darPermiso(suyo.id, 'auth.usuario.asignar_roles');
      permisos.darPermiso(suyo.id, 'ventas.factura.crear');
      const otro = usuarios.agregar('otro');
      const administrador = await roles.darRol(otro.id, E1, {
        nombre: 'Administrador',
        esAdministrador: true,
      });
      const caja = await roles.darRol(otro.id, E1, { nombre: 'Caja' });
      permisos.darPermiso(caja.id, 'ventas.factura.crear');
      const contador = await roles.darRol(otro.id, E1, { nombre: 'Contador' });
      permisos.darPermiso(contador.id, 'contabilidad.asiento.crear');
      const vacio = await roles.darRol(otro.id, E1, { nombre: 'Ébano' });
      await roles.darRol(otro.id, E1, { nombre: 'Archivado', activo: false });
      await roles.darRol(otro.id, E2, { nombre: 'De Zeta' });
      const actorJefa = { ...actor, usuarioId: jefa.id, nombreUsuario: 'jefa' };
      return { otro, administrador, caja, contador, vacio, actorJefa };
    }

    it('solo los activos de su empresa: el Administrador primero, luego por nombre sin tildes', async () => {
      const { actorJefa } = await preparar();
      const lista = await casoDeUso.rolesAsignables(actorJefa);
      expect(lista.map((rol) => rol.nombre)).toEqual([
        'Administrador',
        'Caja',
        'Contador',
        'Ébano',
        'Jefatura',
      ]);
      expect(lista[1]).toEqual({
        id: expect.any(String),
        nombre: 'Caja',
        descripcion: null,
        esAdministrador: false,
        sePuedeDar: true,
      });
    });

    it('quien no es administrador: solo los que tienen permisos suyos, nunca el Administrador', async () => {
      const { actorJefa } = await preparar();
      const sePuede = Object.fromEntries(
        (await casoDeUso.rolesAsignables(actorJefa)).map((rol) => [rol.nombre, rol.sePuedeDar]),
      );
      expect(sePuede).toEqual({
        Administrador: false,
        Caja: true,
        Contador: false,
        Ébano: true,
        Jefatura: true,
      });
    });

    it('un administrador puede darlos todos', async () => {
      const { otro } = await preparar();
      const actorAdmin = { ...actor, usuarioId: otro.id, nombreUsuario: 'otro' };
      const lista = await casoDeUso.rolesAsignables(actorAdmin);
      expect(lista.every((rol) => rol.sePuedeDar)).toBe(true);
    });

    it('sin empresa activa: 404', async () => {
      await expect(casoDeUso.rolesAsignables(actorDelSistema({}))).rejects.toThrow(
        UsuarioNoEncontradoError,
      );
    });
  });
});
