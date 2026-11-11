import { actorDelSistema, type Actor } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import type { Rol } from '../../domain/entities/rol.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  EscaladaError,
  NombreCompletoInvalidoError,
  NombreUsuarioDuplicadoError,
  NombreUsuarioInvalidoError,
  RolDesactivadoError,
  RolDesconocidoError,
  SinRolesError,
  UltimoAdministradorError,
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
import { NombreUsuario } from '../../domain/value-objects/nombre-usuario.vo.js';
import { AccesosUsuariosUseCase } from './accesos-usuarios.use-case.js';

const E1 = idDePrueba(1);
const E2 = idDePrueba(2);
const AHORA = '2026-07-15T11:00:00-05:00';

describe('AccesosUsuariosUseCase', () => {
  let roles: RolesEnMemoria;
  let usuarios: UsuariosEnMemoria;
  let permisos: PermisosEnMemoria;
  let sesiones: SesionesEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let generador: GeneradorContrasenaDePrueba;
  let comunes: Set<string>;
  let casoDeUso: AccesosUsuariosUseCase;
  /** Quien opera: administradora de E1, salvo que la prueba diga otra cosa. */
  let quien: Usuario;
  let actor: Actor;
  let administrador: Rol;
  /** Un rol de E1 con `auth.usuario.ver`. */
  let caja: Rol;
  let ana: Usuario;
  let sueltos = 0;

  function armar(): AccesosUsuariosUseCase {
    return new AccesosUsuariosUseCase(
      usuarios,
      roles,
      permisos,
      sesiones,
      new ConsultarEmpresasDePrueba([
        { id: E1, nombre: 'Comercial del Sur', activo: true },
        { id: E2, nombre: 'Zeta', activo: true },
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

  /** Un rol de la empresa sin asignar a nadie. */
  async function rolSuelto(
    nombre: string,
    codigos: string[] = [],
    opciones: { activo?: boolean; empresaId?: string } = {},
  ): Promise<Rol> {
    const nadie = usuarios.agregar(`nadie${String(sueltos++)}`);
    const rol = await roles.darRol(nadie.id, opciones.empresaId ?? E1, {
      nombre,
      activo: opciones.activo,
    });
    roles.asignaciones.delete(`${nadie.id}:${rol.id}`);
    for (const codigo of codigos) {
      permisos.darPermiso(rol.id, codigo);
    }
    return rol;
  }

  /** Quien opera deja de ser administradora: solo tiene un rol con esos permisos. */
  async function quienSinAdministrador(...codigos: string[]): Promise<void> {
    roles.asignaciones.delete(`${quien.id}:${administrador.id}`);
    const jefe = await roles.darRol(quien.id, E1, { nombre: 'Jefatura' });
    for (const codigo of codigos) {
      permisos.darPermiso(jefe.id, codigo);
    }
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
    actor = { ...actorDelSistema({ empresaId: E1 }), usuarioId: quien.id, nombreUsuario: 'jefa' };
    administrador = await roles.darRol(quien.id, E1, {
      nombre: 'Administrador',
      esAdministrador: true,
    });
    caja = await rolSuelto('Caja', ['auth.usuario.ver']);
    ana = usuarios.agregar('ana', { nombreCompleto: 'Ana' });
    await roles.asignar(ana.id, caja);
  });

  describe('crear', () => {
    it('crea con la temporal (debe cambiarla), le da los roles y lo registra sin la contraseña', async () => {
      const ventas = await rolSuelto('Ventas');
      const creado = await casoDeUso.crear(
        {
          nombreUsuario: ' Beto.Ruiz ',
          nombreCompleto: ' Beto  Ruiz ',
          roles: [ventas.id, caja.id],
        },
        actor,
      );
      expect(creado.contrasenaTemporal).toBe('Temporal-Prueba-1');
      expect(creado.usuario).toMatchObject({
        nombreUsuario: 'beto.ruiz',
        nombreCompleto: 'Beto Ruiz',
        activo: true,
        debeCambiarContrasena: true,
        trabajaEnOtrasEmpresas: false,
        roles: [{ nombre: 'Caja' }, { nombre: 'Ventas' }],
      });
      const guardado = await usuarios.buscarPorId(creado.usuario.id);
      expect(guardado?.hashContrasena).toBe('hash(Temporal-Prueba-1)');
      expect(usuarios.filas.get(creado.usuario.id)?.creadoPor).toBe(quien.id);
      expect(roles.fijadosDeUsuario).toEqual([
        {
          usuarioId: creado.usuario.id,
          empresaId: E1,
          rolIds: [caja.id, ventas.id],
          creadoPor: quien.id,
        },
      ]);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.usuario.crear',
        entidad: 'usuario',
        entidadId: creado.usuario.id,
        despues: {
          nombreUsuario: 'beto.ruiz',
          nombreCompleto: 'Beto Ruiz',
          claveTemporal: true,
          activo: true,
          roles: ['Caja', 'Ventas'],
        },
      });
      expect(JSON.stringify(auditoria.eventos)).not.toContain('Temporal-Prueba');
    });

    it('si la temporal sale común, con su nombre o el de la empresa, genera otra', async () => {
      comunes.add('comunisima12');
      generador = new GeneradorContrasenaDePrueba([
        'comunisima12',
        'xxbeto.ruizx',
        'SurComercial',
        'k7Rm3xTq9vWb',
      ]);
      casoDeUso = armar();
      const creado = await casoDeUso.crear(
        { nombreUsuario: 'beto.ruiz', nombreCompleto: 'Beto', roles: [caja.id] },
        actor,
      );
      expect(creado.contrasenaTemporal).toBe('k7Rm3xTq9vWb');
      expect(generador.pedidas).toBe(4);
    });

    it('si cinco seguidas no sirven: error interno, sin crear nada', async () => {
      comunes.add('comunisima12');
      generador = new GeneradorContrasenaDePrueba(Array.from({ length: 5 }, () => 'comunisima12'));
      casoDeUso = armar();
      await expect(
        casoDeUso.crear({ nombreUsuario: 'beto', nombreCompleto: 'Beto', roles: [caja.id] }, actor),
      ).rejects.toThrow('No se pudo generar una contraseña temporal válida');
      expect(await usuarios.buscarPorNombreUsuario(NombreUsuario.crear('beto'))).toBeNull();
    });

    it('datos mal: error antes de tocar nada', async () => {
      const casos: [
        Parameters<AccesosUsuariosUseCase['crear']>[0],
        new (...argumentos: never[]) => Error,
      ][] = [
        [{ nombreUsuario: ' ', nombreCompleto: 'B', roles: [caja.id] }, NombreUsuarioInvalidoError],
        [
          { nombreUsuario: 'bé', nombreCompleto: 'B', roles: [caja.id] },
          NombreUsuarioInvalidoError,
        ],
        [
          { nombreUsuario: 'beto', nombreCompleto: ' ', roles: [caja.id] },
          NombreCompletoInvalidoError,
        ],
        [{ nombreUsuario: 'beto', nombreCompleto: 'B', roles: [] }, SinRolesError],
      ];
      for (const [comando, error] of casos) {
        await expect(casoDeUso.crear(comando, actor)).rejects.toThrow(error);
      }
      await expect(
        casoDeUso.crear({ nombreUsuario: 'beto', nombreCompleto: 'B', roles: [] }, actor),
      ).rejects.toThrow('Debe elegir al menos un rol');
      expect(generador.pedidas).toBe(0);
      expect(auditoria.eventos).toEqual([]);
    });

    it('un rol de otra empresa o que no existe: 400; uno desactivado: 422', async () => {
      const deZeta = await rolSuelto('Caja de Zeta', [], { empresaId: E2 });
      const apagado = await rolSuelto('Apagado', [], { activo: false });
      for (const ids of [[deZeta.id], [caja.id, idDePrueba(999)]]) {
        await expect(
          casoDeUso.crear({ nombreUsuario: 'beto', nombreCompleto: 'B', roles: ids }, actor),
        ).rejects.toThrow(RolDesconocidoError);
      }
      await expect(
        casoDeUso.crear({ nombreUsuario: 'beto', nombreCompleto: 'B', roles: [apagado.id] }, actor),
      ).rejects.toThrow(RolDesactivadoError);
      expect(roles.fijadosDeUsuario).toEqual([]);
    });

    it('roles repetidos se toman una vez', async () => {
      const creado = await casoDeUso.crear(
        { nombreUsuario: 'beto', nombreCompleto: 'B', roles: [caja.id, caja.id] },
        actor,
      );
      expect(creado.usuario.roles).toHaveLength(1);
    });

    it('un nombre que ya existe: 409', async () => {
      await expect(
        casoDeUso.crear({ nombreUsuario: 'ANA', nombreCompleto: 'Otra', roles: [caja.id] }, actor),
      ).rejects.toThrow(NombreUsuarioDuplicadoError);
    });

    describe('AUTH-D11 sin ser administradora', () => {
      it('da un rol cuyos permisos tiene; uno con permisos que no tiene, no', async () => {
        await quienSinAdministrador('auth.usuario.crear', 'auth.usuario.ver');
        await casoDeUso.crear(
          { nombreUsuario: 'beto', nombreCompleto: 'B', roles: [caja.id] },
          actor,
        );
        const mas = await rolSuelto('Más', ['auth.usuario.ver', 'auth.rol.editar']);
        await expect(
          casoDeUso.crear({ nombreUsuario: 'carla', nombreCompleto: 'C', roles: [mas.id] }, actor),
        ).rejects.toThrow('No puede dar permisos que usted no tiene');
      });

      it('el rol Administrador lo da solo un administrador', async () => {
        await quienSinAdministrador('auth.usuario.crear');
        await expect(
          casoDeUso.crear(
            { nombreUsuario: 'beto', nombreCompleto: 'B', roles: [administrador.id] },
            actor,
          ),
        ).rejects.toThrow('Solo un administrador puede dar o quitar el rol Administrador');
      });
    });
  });

  describe('fijarRoles', () => {
    it('deja exactamente esos y registra el antes y el después', async () => {
      const ventas = await rolSuelto('Ventas');
      const ficha = await casoDeUso.fijarRoles(ana.id, [ventas.id], actor);
      expect(ficha.roles.map((r) => r.nombre)).toEqual(['Ventas']);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.usuario.asignar_roles',
        entidadId: ana.id,
        antes: { roles: ['Caja'] },
        despues: { roles: ['Ventas'] },
      });
    });

    it('los mismos (en otro orden o repetidos): no escribe ni registra', async () => {
      await casoDeUso.fijarRoles(ana.id, [caja.id, caja.id], actor);
      expect(roles.fijadosDeUsuario).toEqual([]);
      expect(auditoria.eventos).toEqual([]);
    });

    it('lista vacía: 400 que manda a Quitar acceso', async () => {
      await expect(casoDeUso.fijarRoles(ana.id, [], actor)).rejects.toThrow(
        'Para quitarle todos los roles use Quitar acceso',
      );
    });

    it('un rol desactivado que ya tenía puede quedar; uno nuevo desactivado, no', async () => {
      const viejo = await rolSuelto('Viejo', [], { activo: false });
      await roles.asignar(ana.id, viejo);
      const ventas = await rolSuelto('Ventas');
      await casoDeUso.fijarRoles(ana.id, [viejo.id, ventas.id], actor);
      expect((await roles.rolesDeUsuario(ana.id, E1)).map((r) => r.nombre.valor)).toEqual([
        'Ventas',
        'Viejo',
      ]);
      const otro = await rolSuelto('Otro apagado', [], { activo: false });
      await expect(casoDeUso.fijarRoles(ana.id, [otro.id], actor)).rejects.toThrow(
        RolDesactivadoError,
      );
    });

    it('uno sin roles aquí, que no existe o sin empresa activa: 404', async () => {
      const beto = usuarios.agregar('beto');
      await roles.darRol(beto.id, E2);
      for (const id of [beto.id, idDePrueba(999)]) {
        await expect(casoDeUso.fijarRoles(id, [caja.id], actor)).rejects.toThrow(
          UsuarioNoEncontradoError,
        );
      }
      await expect(
        casoDeUso.fijarRoles(ana.id, [caja.id], { ...actor, empresaId: null }),
      ).rejects.toThrow(UsuarioNoEncontradoError);
    });

    it('AUTH-D11 (1): nadie cambia sus propios roles, aunque sea administradora o no cambie nada', async () => {
      await expect(casoDeUso.fijarRoles(quien.id, [administrador.id], actor)).rejects.toThrow(
        'No puede cambiar sus propios roles',
      );
      expect(auditoria.eventos).toEqual([]);
    });

    describe('sin ser administradora', () => {
      beforeEach(async () => {
        await quienSinAdministrador('auth.usuario.asignar_roles', 'auth.usuario.ver');
      });

      it('(2) da los que tiene; quitar un rol con permisos que no tiene, sí se puede', async () => {
        const mas = await rolSuelto('Más', ['auth.rol.editar']);
        await expect(casoDeUso.fijarRoles(ana.id, [caja.id, mas.id], actor)).rejects.toThrow(
          'No puede dar permisos que usted no tiene',
        );
        await roles.asignar(ana.id, mas);
        await casoDeUso.fijarRoles(ana.id, [caja.id], actor);
        expect(auditoria.ultimo()).toMatchObject({ despues: { roles: ['Caja'] } });
      });

      it('(3) no da ni quita el rol Administrador', async () => {
        await expect(
          casoDeUso.fijarRoles(ana.id, [caja.id, administrador.id], actor),
        ).rejects.toThrow(EscaladaError);
        const beto = usuarios.agregar('beto');
        await roles.asignar(beto.id, administrador);
        await roles.asignar(beto.id, caja);
        await expect(casoDeUso.fijarRoles(beto.id, [caja.id], actor)).rejects.toThrow(
          'Solo un administrador puede dar o quitar el rol Administrador',
        );
        // Cambiar sus otros roles, dejándole el de Administrador, sí puede.
        const ventas = await rolSuelto('Ventas');
        await casoDeUso.fijarRoles(beto.id, [administrador.id, ventas.id], actor);
      });
    });

    describe('AUTH-D11 (4): la empresa no se queda sin administrador activo', () => {
      let beto: Usuario;

      beforeEach(async () => {
        beto = usuarios.agregar('beto');
        await roles.asignar(beto.id, administrador);
      });

      it('quitarle el rol al único otro administrador activo: 422', async () => {
        // jefa también es administradora: con dos, se puede quitar a uno.
        await casoDeUso.fijarRoles(beto.id, [caja.id], actor);
        // Ahora jefa es la única: si otra administradora (carla) se lo quitara, 422.
        const carla = usuarios.agregar('carla', { activo: false });
        await roles.asignar(carla.id, administrador);
        const actorCarla = { ...actor, usuarioId: carla.id, nombreUsuario: 'carla' };
        await expect(casoDeUso.fijarRoles(quien.id, [caja.id], actorCarla)).rejects.toThrow(
          UltimoAdministradorError,
        );
      });

      it('a un administrador desactivado se le puede quitar (no cuenta)', async () => {
        usuarios.filas.set(beto.id, { usuario: beto.desactivar(), creadoPor: null });
        await casoDeUso.fijarRoles(beto.id, [caja.id], actor);
        expect(auditoria.acciones()).toEqual(['auth.usuario.asignar_roles']);
      });
    });
  });

  describe('quitarAcceso', () => {
    it('le quita sus roles aquí, cierra sus sesiones aquí (no las de otra) y lo registra', async () => {
      await roles.darRol(ana.id, E2, { nombre: 'De Zeta' });
      const aqui = sesiones.agregar({ usuarioId: ana.id, empresaId: E1 });
      const alla = sesiones.agregar({ usuarioId: ana.id, empresaId: E2 });
      const resultado = await casoDeUso.quitarAcceso(ana.id, actor);
      expect(resultado).toEqual({ id: ana.id, sesionesCerradas: 1 });
      expect(await roles.rolesDeUsuario(ana.id, E1)).toEqual([]);
      expect(await roles.rolesDeUsuario(ana.id, E2)).toHaveLength(1);
      expect(sesiones.filas.get(aqui.id)?.datos()).toMatchObject({
        motivoCierre: 'ACCESO_QUITADO',
        cerradaEn: new Date(AHORA),
      });
      expect(sesiones.filas.get(alla.id)?.estaAbierta()).toBe(true);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.usuario.quitar_acceso',
        entidadId: ana.id,
        antes: { roles: ['Caja'] },
        despues: { roles: [], sesionesCerradas: 1 },
      });
    });

    it('a sí misma no (AUTH-D11 (1)); a uno que no es de aquí, 404', async () => {
      await expect(casoDeUso.quitarAcceso(quien.id, actor)).rejects.toThrow(
        'No puede cambiar sus propios roles',
      );
      await expect(casoDeUso.quitarAcceso(idDePrueba(999), actor)).rejects.toThrow(
        UsuarioNoEncontradoError,
      );
    });

    it('al único otro administrador: 422; sin ser administradora, a un administrador: 403', async () => {
      const beto = usuarios.agregar('beto');
      await roles.asignar(beto.id, administrador);
      // Con dos administradores activos, la jefa puede quitárselo a beto.
      await casoDeUso.quitarAcceso(beto.id, actor);
      await roles.asignar(beto.id, administrador);
      roles.asignaciones.delete(`${quien.id}:${administrador.id}`);
      await quienSinAdministrador('auth.usuario.asignar_roles');
      await expect(casoDeUso.quitarAcceso(beto.id, actor)).rejects.toThrow(
        'Solo un administrador puede dar o quitar el rol Administrador',
      );
      // Beto es el único: otra administradora desactivada no cuenta.
      const carla = usuarios.agregar('carla', { activo: false });
      await roles.asignar(carla.id, administrador);
      const actorAdmin = { ...actor, usuarioId: carla.id, nombreUsuario: 'carla' };
      await expect(casoDeUso.quitarAcceso(beto.id, actorAdmin)).rejects.toThrow(
        UltimoAdministradorError,
      );
    });
  });
});
