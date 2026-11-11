import { actorDelSistema } from '../../../../shared/application/actor.js';
import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import {
  ContrasenaDebilError,
  NombreUsuarioDuplicadoError,
  NombreUsuarioInvalidoError,
  UsuarioInactivoError,
  UsuarioNoEncontradoError,
} from '../../domain/errors/auth.errors.js';
import type { CrearEmpresaConAdministradorComando } from '../ports/in/crear-empresa-con-administrador.port.js';
import {
  CrearEmpresaDePrueba,
  HasherDePrueba,
  idDePrueba,
  RolesEnMemoria,
  UsuariosEnMemoria,
} from '../testing/auth-en-memoria.js';
import {
  CrearEmpresaConAdministradorUseCase,
  DESCRIPCION_ROL_ADMINISTRADOR,
} from './crear-empresa-con-administrador.use-case.js';

const EMPRESA = idDePrueba(1);
const CONTRASENA = 'Margarita-Lunes-47';

const conNuevo: CrearEmpresaConAdministradorComando = {
  nombreEmpresa: 'Comercial del Sur',
  administrador: {
    tipo: 'nuevo',
    nombreUsuario: ' Ana.Perez ',
    nombreCompleto: ' Ana  Pérez ',
    contrasena: CONTRASENA,
  },
};

describe('CrearEmpresaConAdministradorUseCase', () => {
  const actor = actorDelSistema({ nombreUsuario: 'comando' });
  let empresas: CrearEmpresaDePrueba;
  let usuarios: UsuariosEnMemoria;
  let roles: RolesEnMemoria;
  let auditoria: AuditoriaEnMemoria;
  let comunes: Set<string>;
  let casoDeUso: CrearEmpresaConAdministradorUseCase;

  beforeEach(() => {
    usuarios = new UsuariosEnMemoria();
    roles = new RolesEnMemoria();
    auditoria = new AuditoriaEnMemoria();
    empresas = new CrearEmpresaDePrueba(auditoria);
    comunes = new Set(['contrasena123']);
    const unidad = { ejecutar: <T>(fn: () => Promise<T>) => fn() };
    casoDeUso = new CrearEmpresaConAdministradorUseCase(
      usuarios,
      roles,
      new HasherDePrueba(),
      { esComun: (texto) => comunes.has(texto) },
      empresas,
      unidad,
      auditoria,
    );
  });

  describe('con un usuario nuevo', () => {
    it('crea la empresa, su rol Administrador y el usuario con ese rol', async () => {
      const resultado = await casoDeUso.crear(conNuevo, actor);

      expect(resultado.empresa).toEqual({ id: EMPRESA, nombre: 'Comercial del Sur', activo: true });
      expect(resultado.usuarioNuevo).toBe(true);
      expect(resultado.administrador).toMatchObject({
        nombreUsuario: 'ana.perez',
        nombreCompleto: 'Ana Pérez',
        activo: true,
      });
      const rol = await roles.buscarAdministrador(EMPRESA);
      expect(rol?.datos()).toMatchObject({
        nombre: 'Administrador',
        descripcion: DESCRIPCION_ROL_ADMINISTRADOR,
        esAdministrador: true,
        activo: true,
      });
      expect(await roles.rolesDeUsuario(resultado.administrador.id, EMPRESA)).toEqual([rol]);
    });

    it('guarda solo el hash y obliga a cambiar la contraseña al entrar', async () => {
      const { administrador } = await casoDeUso.crear(conNuevo, actor);
      const usuario = await usuarios.buscarPorId(administrador.id);
      expect(usuario?.hashContrasena).toBe(`hash(${CONTRASENA})`);
      expect(usuario?.debeCambiarContrasena).toBe(true);
      expect(usuarios.filas.get(administrador.id)?.creadoPor).toBeNull();
    });

    it('registra empresa, rol y usuario, todos en la empresa nueva y sin la contraseña', async () => {
      const { administrador } = await casoDeUso.crear(conNuevo, actor);
      expect(auditoria.acciones()).toEqual([
        'empresas.empresa.crear',
        'auth.rol.crear',
        'auth.usuario.crear',
      ]);
      expect(auditoria.eventos.every((evento) => evento.empresaId === EMPRESA)).toBe(true);
      expect(auditoria.eventos[2]).toMatchObject({
        usuarioId: null,
        nombreUsuario: 'comando',
        entidad: 'usuario',
        entidadId: administrador.id,
        despues: {
          nombreUsuario: 'ana.perez',
          nombreCompleto: 'Ana Pérez',
          claveTemporal: true,
          activo: true,
          roles: ['Administrador'],
        },
      });
      expect(JSON.stringify(auditoria.eventos)).not.toContain(CONTRASENA);
    });

    it.each([
      ['corta', 'abc', 'al menos 8'],
      ['común', 'Contrasena123', 'demasiado común'],
      ['con el usuario', 'ana.perez-2026', 'su nombre de usuario'],
      ['con la empresa', 'Comercial-2026!', 'nombre de la empresa'],
    ])('rechaza una contraseña %s sin crear nada', async (_caso, contrasena, mensaje) => {
      const comando = {
        ...conNuevo,
        administrador: { ...conNuevo.administrador, contrasena },
      } as CrearEmpresaConAdministradorComando;
      const intento = casoDeUso.crear(comando, actor);
      await expect(intento).rejects.toThrow(ContrasenaDebilError);
      await expect(intento).rejects.toThrow(mensaje);
      expect(empresas.creadas.length).toBe(0);
      expect(usuarios.filas.size).toBe(0);
      expect(auditoria.eventos).toHaveLength(0);
    });

    it('un nombre de usuario que ya existe: NombreUsuarioDuplicadoError', async () => {
      usuarios.agregar('ana.perez');
      await expect(casoDeUso.crear(conNuevo, actor)).rejects.toThrow(NombreUsuarioDuplicadoError);
    });

    it('un nombre de usuario con formato inválido: NombreUsuarioInvalidoError', async () => {
      const comando = {
        ...conNuevo,
        administrador: { ...conNuevo.administrador, nombreUsuario: 'Ana Pérez' },
      } as CrearEmpresaConAdministradorComando;
      await expect(casoDeUso.crear(comando, actor)).rejects.toThrow(NombreUsuarioInvalidoError);
    });
  });

  describe('con un usuario existente', () => {
    const conExistente: CrearEmpresaConAdministradorComando = {
      nombreEmpresa: 'Segunda',
      administrador: { tipo: 'existente', nombreUsuario: 'LUIS' },
    };

    it('le da el rol Administrador de la empresa nueva sin tocar su contraseña', async () => {
      const luis = usuarios.agregar('luis', { hashContrasena: 'el-suyo' });
      const resultado = await casoDeUso.crear(conExistente, actor);

      expect(resultado.usuarioNuevo).toBe(false);
      expect(resultado.administrador.id).toBe(luis.id);
      const rol = await roles.buscarAdministrador(resultado.empresa.id);
      expect(await roles.rolesDeUsuario(luis.id, resultado.empresa.id)).toEqual([rol]);
      expect((await usuarios.buscarPorId(luis.id))?.hashContrasena).toBe('el-suyo');
      expect(auditoria.acciones()).toEqual([
        'empresas.empresa.crear',
        'auth.rol.crear',
        'auth.usuario.dar_acceso',
      ]);
      expect(auditoria.eventos[2]).toMatchObject({
        entidadId: luis.id,
        despues: { roles: ['Administrador'] },
      });
    });

    it('si no existe: UsuarioNoEncontradoError y no crea la empresa', async () => {
      await expect(casoDeUso.crear(conExistente, actor)).rejects.toThrow(UsuarioNoEncontradoError);
      await expect(casoDeUso.crear(conExistente, actor)).rejects.toThrow(
        'No existe el usuario «luis»',
      );
      expect(empresas.creadas.length).toBe(0);
    });

    it('si está desactivado: UsuarioInactivoError', async () => {
      usuarios.agregar('luis', { activo: false });
      await expect(casoDeUso.crear(conExistente, actor)).rejects.toThrow(UsuarioInactivoError);
      expect(empresas.creadas.length).toBe(0);
    });
  });

  describe('buscarUsuario()', () => {
    it('lo encuentra sin importar mayúsculas ni espacios, sin el hash', async () => {
      const luis = usuarios.agregar('luis', { activo: false });
      expect(await casoDeUso.buscarUsuario(' Luis ')).toEqual({
        id: luis.id,
        nombreUsuario: 'luis',
        nombreCompleto: 'luis',
        activo: false,
      });
    });

    it('null si no existe; NombreUsuarioInvalidoError si el formato no sirve', async () => {
      expect(await casoDeUso.buscarUsuario('nadie')).toBeNull();
      await expect(casoDeUso.buscarUsuario('a b')).rejects.toThrow(NombreUsuarioInvalidoError);
    });
  });
});
