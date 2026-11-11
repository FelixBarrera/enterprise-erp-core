import type { Actor } from '../../../../shared/application/actor.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import type { Rol } from '../../domain/entities/rol.entity.js';
import {
  EscaladaError,
  NombreRolDuplicadoError,
  NombreRolInvalidoError,
  PermisoDesconocidoError,
  RolAdministradorFijoError,
  RolNoEncontradoError,
} from '../../domain/errors/auth.errors.js';
import { NombreRol } from '../../domain/value-objects/nombre-rol.vo.js';
import { idDePrueba, PermisosEnMemoria, RolesEnMemoria } from '../testing/auth-en-memoria.js';
import { AdministrarRolesUseCase } from './administrar-roles.use-case.js';

const E1 = idDePrueba(1);
const E2 = idDePrueba(2);
const ANA = idDePrueba(90);
const JEFA = idDePrueba(91);
const OTRO = idDePrueba(92);

const actor = (usuarioId: string, empresaId: string | null = E1): Actor => ({
  usuarioId,
  nombreUsuario: usuarioId === ANA ? 'ana' : 'jefa',
  empresaId,
  ip: '10.0.0.1',
  navegador: null,
  requestId: 'req-1',
});

describe('AdministrarRolesUseCase', () => {
  let roles: RolesEnMemoria;
  let permisos: PermisosEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let casoDeUso: AdministrarRolesUseCase;
  let administrador: Rol;
  let caja: Rol;
  let cajaDeZeta: Rol;

  beforeEach(async () => {
    roles = new RolesEnMemoria();
    permisos = new PermisosEnMemoria(roles);
    // El catálogo, en orden de código (como lo devuelve la base).
    for (const codigo of [
      'auth.rol.editar',
      'auth.rol.ver',
      'auth.usuario.ver',
      'ventas.factura.crear',
    ]) {
      permisos.agregar(codigo);
    }
    permisos.agregar('viejo.cosa.hacer', 'Ya no se usa', true);
    administrador = await roles.darRol(ANA, E1, { nombre: 'Administrador', esAdministrador: true });
    // La jefa no es administradora: puede editar roles y ver usuarios.
    const jefa = await roles.darRol(JEFA, E1, { nombre: 'Jefatura' });
    permisos.darPermiso(jefa.id, 'auth.rol.editar');
    permisos.darPermiso(jefa.id, 'auth.usuario.ver');
    caja = await roles.darRol(OTRO, E1, { nombre: 'Caja' });
    permisos.darPermiso(caja.id, 'ventas.factura.crear');
    cajaDeZeta = await roles.crear({
      empresaId: E2,
      nombre: NombreRol.crear('Caja'),
      descripcion: null,
      esAdministrador: false,
    });
    auditoria = new AuditoriaEnMemoria();
    casoDeUso = new AdministrarRolesUseCase(
      roles,
      permisos,
      { ejecutar: (fn) => fn() },
      auditoria,
      auditoria,
    );
  });

  describe('crear', () => {
    it('con permisos: sin repetir, en el orden del catálogo, y lo registra', async () => {
      const rol = await casoDeUso.crear(
        {
          nombre: '  Ventas   mostrador ',
          descripcion: ' Atiende ',
          permisos: ['ventas.factura.crear', 'auth.rol.ver', 'ventas.factura.crear'],
        },
        actor(ANA),
      );
      expect(rol).toMatchObject({
        nombre: 'Ventas mostrador',
        descripcion: 'Atiende',
        esAdministrador: false,
        activo: true,
        permisos: ['auth.rol.ver', 'ventas.factura.crear'],
        cantidadUsuarios: 0,
      });
      expect(roles.roles.get(rol.id)?.empresaId).toBe(E1);
      expect(permisos.fijados).toEqual([
        { rolId: rol.id, codigos: ['auth.rol.ver', 'ventas.factura.crear'], creadoPor: ANA },
      ]);
      expect(auditoria.eventos).toHaveLength(1);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.rol.crear',
        empresaId: E1,
        entidad: 'rol',
        entidadId: rol.id,
        antes: null,
        despues: {
          nombre: 'Ventas mostrador',
          descripcion: 'Atiende',
          permisos: ['auth.rol.ver', 'ventas.factura.crear'],
        },
      });
    });

    it('sin permisos ni descripción (vacía o null): no fija nada', async () => {
      for (const [nombre, descripcion] of [
        ['Uno', undefined],
        ['Dos', null],
        ['Tres', '   '],
      ] as const) {
        const rol = await casoDeUso.crear({ nombre, descripcion }, actor(ANA));
        expect(rol).toMatchObject({ descripcion: null, permisos: [] });
      }
      expect(permisos.fijados).toEqual([]);
    });

    it('nombre inválido: no toca nada', async () => {
      await expect(casoDeUso.crear({ nombre: '   ' }, actor(ANA))).rejects.toThrow(
        NombreRolInvalidoError,
      );
      await expect(
        casoDeUso.crear({ nombre: 'x', descripcion: 'd'.repeat(251) }, actor(ANA)),
      ).rejects.toThrow('La descripción del rol no puede pasar de 250 caracteres');
      expect(roles.roles.size).toBe(4);
      expect(auditoria.eventos).toEqual([]);
    });

    it('un permiso que no existe o ya es obsoleto: 400, sin crear', async () => {
      for (const codigo of ['no.existe.nada', 'viejo.cosa.hacer']) {
        await expect(
          casoDeUso.crear({ nombre: 'Nuevo', permisos: [codigo] }, actor(ANA)),
        ).rejects.toThrow(new PermisoDesconocidoError(codigo));
      }
      expect(roles.roles.size).toBe(4);
    });

    it('quien no es administrador solo da los permisos que tiene (AUTH-D11 (2))', async () => {
      await expect(
        casoDeUso.crear({ nombre: 'Nuevo', permisos: ['ventas.factura.crear'] }, actor(JEFA)),
      ).rejects.toThrow(EscaladaError);
      expect(roles.roles.size).toBe(4);
      const rol = await casoDeUso.crear(
        { nombre: 'Nuevo', permisos: ['auth.usuario.ver'] },
        actor(JEFA),
      );
      expect(rol.permisos).toEqual(['auth.usuario.ver']);
    });

    it('un nombre que ya tiene otro activo de la empresa (sin mayúsculas ni tildes): 409', async () => {
      await expect(casoDeUso.crear({ nombre: 'CAJA' }, actor(ANA))).rejects.toThrow(
        NombreRolDuplicadoError,
      );
      expect(auditoria.eventos).toEqual([]);
    });

    it('sin empresa activa: ningún rol existe', async () => {
      await expect(casoDeUso.crear({ nombre: 'X' }, actor(ANA, null))).rejects.toThrow(
        RolNoEncontradoError,
      );
    });
  });

  describe('editar', () => {
    it('cambia nombre y descripción, guarda quién y registra solo lo que cambió', async () => {
      const rol = await casoDeUso.editar(
        caja.id,
        { nombre: 'Cajero', descripcion: 'Cobra' },
        actor(ANA),
      );
      expect(rol).toMatchObject({
        id: caja.id,
        nombre: 'Cajero',
        descripcion: 'Cobra',
        permisos: ['ventas.factura.crear'],
        cantidadUsuarios: 1,
      });
      expect(roles.roles.get(caja.id)?.nombre.valor).toBe('Cajero');
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.rol.editar',
        entidadId: caja.id,
        antes: { nombre: 'Caja', descripcion: null },
        despues: { nombre: 'Cajero', descripcion: 'Cobra' },
      });
    });

    it('un campo que no viene queda igual; descripción null la quita', async () => {
      await casoDeUso.editar(caja.id, { descripcion: 'Cobra' }, actor(ANA));
      const rol = await casoDeUso.editar(caja.id, { descripcion: null }, actor(ANA));
      expect(rol).toMatchObject({ nombre: 'Caja', descripcion: null });
      expect(auditoria.ultimo()).toMatchObject({
        antes: { descripcion: 'Cobra' },
        despues: { descripcion: null },
      });
    });

    it('sin cambios (sin campos o lo mismo con otros espacios): no escribe ni registra', async () => {
      await casoDeUso.editar(caja.id, {}, actor(ANA));
      await casoDeUso.editar(caja.id, { nombre: ' Caja ', descripcion: '' }, actor(ANA));
      expect(roles.guardados).toBe(0);
      expect(auditoria.eventos).toEqual([]);
    });

    it('el Administrador no se edita (AUTH-D10), ni aunque no cambie nada', async () => {
      for (const comando of [{ nombre: 'Jefe' }, {}]) {
        await expect(casoDeUso.editar(administrador.id, comando, actor(ANA))).rejects.toThrow(
          RolAdministradorFijoError,
        );
      }
    });

    it('un rol de otra empresa, o que no existe: 404', async () => {
      for (const id of [cajaDeZeta.id, idDePrueba(999)]) {
        await expect(casoDeUso.editar(id, { nombre: 'X' }, actor(ANA))).rejects.toThrow(
          RolNoEncontradoError,
        );
      }
      expect(roles.roles.get(cajaDeZeta.id)?.nombre.valor).toBe('Caja');
    });

    it('el nombre de otro rol activo: 409', async () => {
      await expect(casoDeUso.editar(caja.id, { nombre: 'jefatura' }, actor(ANA))).rejects.toThrow(
        NombreRolDuplicadoError,
      );
    });
  });

  describe('pie de la ficha (de la bitácora de la empresa)', () => {
    it('al crear: creado por quien lo hizo, sin modificado; cambiar permisos o datos cuenta', async () => {
      const nuevo = await casoDeUso.crear({ nombre: 'Ventas' }, actor(ANA));
      expect(nuevo.creado).toEqual({ en: expect.any(Date), por: 'ana' });
      expect(nuevo.modificado).toBeNull();

      const conPermisos = await casoDeUso.fijarPermisos(
        nuevo.id,
        ['auth.usuario.ver'],
        actor(JEFA),
      );
      expect(conPermisos.creado?.por).toBe('ana');
      expect(conPermisos.modificado?.por).toBe('jefa');

      const editado = await casoDeUso.editar(nuevo.id, { nombre: 'Ventas 2' }, actor(ANA));
      expect(editado.modificado?.por).toBe('ana');
    });

    it('un rol sin eventos en la bitácora (anterior a ella): sin pie', async () => {
      const rol = await casoDeUso.desactivar(caja.id, actor(ANA));
      expect(rol.creado).toBeNull();
      expect(rol.modificado?.por).toBe('ana');
    });
  });

  describe('fijarPermisos', () => {
    it('deja exactamente esos y registra antes y después', async () => {
      const rol = await casoDeUso.fijarPermisos(
        caja.id,
        ['auth.usuario.ver', 'auth.rol.ver'],
        actor(ANA),
      );
      expect(rol.permisos).toEqual(['auth.rol.ver', 'auth.usuario.ver']);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.rol.permisos',
        entidadId: caja.id,
        antes: { permisos: ['ventas.factura.crear'] },
        despues: { permisos: ['auth.rol.ver', 'auth.usuario.ver'] },
      });
    });

    it('los mismos (en otro orden o repetidos): no escribe ni registra', async () => {
      await casoDeUso.fijarPermisos(
        caja.id,
        ['ventas.factura.crear', 'ventas.factura.crear'],
        actor(ANA),
      );
      expect(permisos.fijados).toEqual([]);
      expect(auditoria.eventos).toEqual([]);
    });

    it('quien no es administrador quita cualquiera pero solo agrega los que tiene', async () => {
      await expect(
        casoDeUso.fijarPermisos(caja.id, ['ventas.factura.crear', 'auth.rol.ver'], actor(JEFA)),
      ).rejects.toThrow(EscaladaError);
      const rol = await casoDeUso.fijarPermisos(caja.id, ['auth.usuario.ver'], actor(JEFA));
      expect(rol.permisos).toEqual(['auth.usuario.ver']);
    });

    it('el Administrador no se edita; un permiso desconocido, 400; otra empresa, 404', async () => {
      await expect(casoDeUso.fijarPermisos(administrador.id, [], actor(ANA))).rejects.toThrow(
        RolAdministradorFijoError,
      );
      await expect(casoDeUso.fijarPermisos(caja.id, ['x.y.z'], actor(ANA))).rejects.toThrow(
        PermisoDesconocidoError,
      );
      await expect(casoDeUso.fijarPermisos(cajaDeZeta.id, [], actor(ANA))).rejects.toThrow(
        RolNoEncontradoError,
      );
      expect(auditoria.eventos).toEqual([]);
    });
  });

  describe('desactivar y reactivar', () => {
    it('desactiva y registra; si ya estaba desactivado, no hace nada', async () => {
      const rol = await casoDeUso.desactivar(caja.id, actor(ANA));
      expect(rol.activo).toBe(false);
      expect(roles.roles.get(caja.id)?.activo).toBe(false);
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.rol.desactivar',
        antes: { activo: true },
        despues: { activo: false },
      });
      await casoDeUso.desactivar(caja.id, actor(ANA));
      expect(auditoria.eventos).toHaveLength(1);
    });

    it('reactiva y registra; si ya estaba activo, no hace nada', async () => {
      await casoDeUso.reactivar(caja.id, actor(ANA));
      expect(auditoria.eventos).toEqual([]);
      await casoDeUso.desactivar(caja.id, actor(ANA));
      const rol = await casoDeUso.reactivar(caja.id, actor(ANA));
      expect(rol.activo).toBe(true);
      expect(auditoria.acciones()).toEqual(['auth.rol.desactivar', 'auth.rol.reactivar']);
    });

    it('el Administrador no se desactiva ni se reactiva (AUTH-D10)', async () => {
      await expect(casoDeUso.desactivar(administrador.id, actor(ANA))).rejects.toThrow(
        RolAdministradorFijoError,
      );
      await expect(casoDeUso.reactivar(administrador.id, actor(ANA))).rejects.toThrow(
        RolAdministradorFijoError,
      );
    });

    it('quien no es administrador reactiva solo si tiene todos sus permisos (6.7b)', async () => {
      await casoDeUso.desactivar(caja.id, actor(JEFA));
      await expect(casoDeUso.reactivar(caja.id, actor(JEFA))).rejects.toThrow(EscaladaError);
      expect(roles.roles.get(caja.id)?.activo).toBe(false);
      await casoDeUso.fijarPermisos(caja.id, ['auth.usuario.ver'], actor(ANA));
      expect((await casoDeUso.reactivar(caja.id, actor(JEFA))).activo).toBe(true);
    });

    it('reactivar con un nombre que ya tomó otro activo: 409', async () => {
      await casoDeUso.desactivar(caja.id, actor(ANA));
      await casoDeUso.crear({ nombre: 'Caja' }, actor(ANA));
      await expect(casoDeUso.reactivar(caja.id, actor(ANA))).rejects.toThrow(
        NombreRolDuplicadoError,
      );
    });

    it('un rol de otra empresa: 404', async () => {
      await expect(casoDeUso.desactivar(cajaDeZeta.id, actor(ANA))).rejects.toThrow(
        RolNoEncontradoError,
      );
      await expect(casoDeUso.reactivar(cajaDeZeta.id, actor(ANA))).rejects.toThrow(
        RolNoEncontradoError,
      );
    });
  });
});
