import { actorDelSistema, type Actor } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  NombreCompletoInvalidoError,
  UsuarioDeOtraEmpresaError,
  UsuarioNoEncontradoError,
} from '../../domain/errors/auth.errors.js';
import {
  ConsultarEmpresasDePrueba,
  idDePrueba,
  PermisosEnMemoria,
  RolesEnMemoria,
  SesionesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import { AdministrarUsuariosUseCase } from './administrar-usuarios.use-case.js';

const E1 = idDePrueba(1);
const E2 = idDePrueba(2);
const E3 = idDePrueba(3);

describe('AdministrarUsuariosUseCase', () => {
  let roles: RolesEnMemoria;
  let usuarios: UsuariosEnMemoria;
  let permisos: PermisosEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let casoDeUso: AdministrarUsuariosUseCase;
  let quien: Usuario;
  let actor: Actor;
  let ana: Usuario;

  /** Quien opera, con un rol en esa empresa que da esos permisos. */
  async function permisosDeQuien(empresaId: string, ...codigos: string[]): Promise<void> {
    const rol = await roles.darRol(quien.id, empresaId, { nombre: `Jefe ${empresaId}` });
    for (const codigo of codigos) {
      permisos.darPermiso(rol.id, codigo);
    }
  }

  beforeEach(async () => {
    roles = new RolesEnMemoria();
    usuarios = new UsuariosEnMemoria(roles);
    permisos = new PermisosEnMemoria(roles);
    auditoria = new AuditoriaEnMemoria();
    casoDeUso = new AdministrarUsuariosUseCase(
      usuarios,
      roles,
      permisos,
      new SesionesEnMemoria(),
      new ConsultarEmpresasDePrueba([
        { id: E1, nombre: 'Sur', activo: true },
        { id: E2, nombre: 'Zeta', activo: true },
        { id: E3, nombre: 'Cerrada', activo: false },
      ]),
      { ejecutar: (fn) => fn() },
      auditoria,
      new RelojFijo('2026-07-15T11:00:00-05:00'),
      { duracionMaximaHoras: 13, inactividadMinutos: 120 },
      auditoria,
    );
    quien = usuarios.agregar('jefa');
    actor = { ...actorDelSistema({ empresaId: E1 }), usuarioId: quien.id, nombreUsuario: 'jefa' };
    await permisosDeQuien(E1, 'auth.usuario.editar');
    ana = usuarios.agregar('ana', { nombreCompleto: 'Ana' });
    await roles.darRol(ana.id, E1, { nombre: 'Caja' });
  });

  describe('editar', () => {
    it('cambia el nombre (limpio), lo guarda y lo registra con el antes y el después', async () => {
      const ficha = await casoDeUso.editar(ana.id, { nombreCompleto: '  Ana   Pérez ' }, actor);
      expect(ficha).toMatchObject({ id: ana.id, nombreCompleto: 'Ana Pérez' });
      expect((await usuarios.buscarPorId(ana.id))?.nombreCompleto.valor).toBe('Ana Pérez');
      expect(auditoria.ultimo()).toMatchObject({
        accion: 'auth.usuario.editar',
        entidad: 'usuario',
        entidadId: ana.id,
        antes: { nombreCompleto: 'Ana' },
        despues: { nombreCompleto: 'Ana Pérez' },
      });
    });

    it('sin el campo, o con el mismo nombre: no escribe ni registra', async () => {
      await casoDeUso.editar(ana.id, {}, actor);
      await casoDeUso.editar(ana.id, { nombreCompleto: ' Ana ' }, actor);
      expect(usuarios.guardados).toBe(0);
      expect(auditoria.eventos).toEqual([]);
    });

    it('un nombre vacío o largo: error antes de tocar nada', async () => {
      await expect(casoDeUso.editar(ana.id, { nombreCompleto: '  ' }, actor)).rejects.toThrow(
        NombreCompletoInvalidoError,
      );
      await expect(
        casoDeUso.editar(ana.id, { nombreCompleto: 'x'.repeat(151) }, actor),
      ).rejects.toThrow('El nombre completo no puede pasar de 150 caracteres');
      expect(usuarios.guardados).toBe(0);
    });

    it('uno sin roles en esta empresa, que no existe o sin empresa activa: 404', async () => {
      const beto = usuarios.agregar('beto');
      await roles.darRol(beto.id, E2);
      for (const id of [beto.id, idDePrueba(999)]) {
        await expect(casoDeUso.editar(id, { nombreCompleto: 'X' }, actor)).rejects.toThrow(
          UsuarioNoEncontradoError,
        );
      }
      await expect(
        casoDeUso.editar(ana.id, { nombreCompleto: 'X' }, { ...actor, empresaId: null }),
      ).rejects.toThrow(UsuarioNoEncontradoError);
      expect(usuarios.guardados).toBe(0);
    });

    describe('AUTH-D12: si trabaja en otra empresa, hace falta el permiso en todas', () => {
      beforeEach(async () => {
        await roles.darRol(ana.id, E2, { nombre: 'De Zeta' });
      });

      it('sin el permiso en la otra: 403, aunque nada cambie, y no escribe', async () => {
        for (const comando of [{ nombreCompleto: 'Otra' }, {}]) {
          await expect(casoDeUso.editar(ana.id, comando, actor)).rejects.toThrow(
            UsuarioDeOtraEmpresaError,
          );
        }
        // Tener otro permiso en la otra empresa no alcanza.
        await permisosDeQuien(E2, 'auth.usuario.ver');
        await expect(casoDeUso.editar(ana.id, { nombreCompleto: 'Otra' }, actor)).rejects.toThrow(
          UsuarioDeOtraEmpresaError,
        );
        expect(usuarios.guardados).toBe(0);
        expect(auditoria.eventos).toEqual([]);
      });

      it('con el permiso en las dos, o siendo Administrador de la otra: se puede', async () => {
        await permisosDeQuien(E2, 'auth.usuario.editar');
        await casoDeUso.editar(ana.id, { nombreCompleto: 'Ana Dos' }, actor);
        expect(auditoria.acciones()).toEqual(['auth.usuario.editar']);

        roles.asignaciones.clear();
        await roles.darRol(ana.id, E1);
        await roles.darRol(ana.id, E2);
        await permisosDeQuien(E1, 'auth.usuario.editar');
        await roles.darRol(quien.id, E2, { nombre: 'Administrador', esAdministrador: true });
        await casoDeUso.editar(ana.id, { nombreCompleto: 'Ana Tres' }, actor);
        expect(auditoria.acciones()).toHaveLength(2);
      });

      it('un rol desactivado en la otra cuenta; una empresa desactivada, no', async () => {
        roles.asignaciones.clear();
        await roles.darRol(ana.id, E1);
        await permisosDeQuien(E1, 'auth.usuario.editar');
        await roles.darRol(ana.id, E3);
        await casoDeUso.editar(ana.id, { nombreCompleto: 'Pasa' }, actor);
        await roles.darRol(ana.id, E2, { activo: false });
        await expect(casoDeUso.editar(ana.id, { nombreCompleto: 'No' }, actor)).rejects.toThrow(
          UsuarioDeOtraEmpresaError,
        );
      });

      it('un rol desactivado de quien opera no le da el permiso', async () => {
        const rol = await roles.darRol(quien.id, E2, { activo: false });
        permisos.darPermiso(rol.id, 'auth.usuario.editar');
        await expect(casoDeUso.editar(ana.id, { nombreCompleto: 'No' }, actor)).rejects.toThrow(
          UsuarioDeOtraEmpresaError,
        );
      });
    });

    it('puede cambiar su propio nombre (AUTH-D11 es solo de los roles)', async () => {
      const ficha = await casoDeUso.editar(quien.id, { nombreCompleto: 'Jefa Nueva' }, actor);
      expect(ficha.nombreCompleto).toBe('Jefa Nueva');
    });
  });
});
