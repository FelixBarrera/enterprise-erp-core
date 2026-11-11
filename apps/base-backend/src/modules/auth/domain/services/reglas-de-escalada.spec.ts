import {
  EscaladaError,
  RolAdministradorFijoError,
  UltimoAdministradorError,
  UsuarioDeOtraEmpresaError,
} from '../errors/auth.errors.js';
import { type QuienActua, ReglasDeEscalada, type RolConPermisos } from './reglas-de-escalada.js';

const ADMIN: QuienActua = { usuarioId: 'admin', esAdministrador: true, permisos: [] };
const JEFA: QuienActua = {
  usuarioId: 'jefa',
  esAdministrador: false,
  permisos: ['auth.usuario.ver', 'auth.usuario.asignar_roles', 'ventas.factura.crear'],
};

const ADMINISTRADOR: RolConPermisos = { id: 'r-admin', esAdministrador: true, permisos: [] };
const CAJA: RolConPermisos = {
  id: 'r-caja',
  esAdministrador: false,
  permisos: ['ventas.factura.crear'],
};
const CONTADOR: RolConPermisos = {
  id: 'r-contador',
  esAdministrador: false,
  permisos: ['contabilidad.asiento.crear'],
};
const SIN_PERMISOS: RolConPermisos = { id: 'r-vacio', esAdministrador: false, permisos: [] };

const motivo = (fn: () => void): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof EscaladaError ? e.motivo : String(e);
  }
};

describe('ReglasDeEscalada', () => {
  describe('cambio de roles de un usuario (AUTH-D11)', () => {
    const cambiar = (quien: QuienActua, actuales: RolConPermisos[], nuevos: RolConPermisos[]) =>
      motivo(() =>
        ReglasDeEscalada.revisarCambioDeRoles({ quien, usuarioId: 'beto', actuales, nuevos }),
      );

    it('(1) nadie cambia sus propios roles, ni el administrador', () => {
      for (const quien of [ADMIN, JEFA]) {
        expect(
          motivo(() =>
            ReglasDeEscalada.revisarCambioDeRoles({
              quien,
              usuarioId: quien.usuarioId,
              actuales: [],
              nuevos: [SIN_PERMISOS],
            }),
          ),
        ).toBe('propios_roles');
      }
    });

    it('el administrador da y quita cualquier rol, también el Administrador', () => {
      expect(cambiar(ADMIN, [], [ADMINISTRADOR, CONTADOR])).toBeNull();
      expect(cambiar(ADMIN, [ADMINISTRADOR, CONTADOR], [])).toBeNull();
    });

    it('(2) quien no es administrador da roles cuyos permisos tiene (también uno sin permisos)', () => {
      expect(cambiar(JEFA, [], [CAJA, SIN_PERMISOS])).toBeNull();
      expect(cambiar(JEFA, [], [CAJA, CONTADOR])).toBe('permisos_que_no_tiene');
    });

    it('(2) solo se revisa lo que da: quitar o dejar un rol que él no tiene, sí puede', () => {
      expect(cambiar(JEFA, [CONTADOR, CAJA], [])).toBeNull();
      expect(cambiar(JEFA, [CONTADOR], [CONTADOR, CAJA])).toBeNull();
    });

    it('(3) quien no es administrador no da ni quita el rol Administrador', () => {
      expect(cambiar(JEFA, [], [ADMINISTRADOR])).toBe('solo_administrador');
      expect(cambiar(JEFA, [ADMINISTRADOR], [])).toBe('solo_administrador');
      // Dejarlo como está no es darlo ni quitarlo.
      expect(cambiar(JEFA, [ADMINISTRADOR], [ADMINISTRADOR, CAJA])).toBeNull();
    });

    it('el mensaje de cada motivo', () => {
      expect(new EscaladaError('propios_roles').message).toBe('No puede cambiar sus propios roles');
      expect(new EscaladaError('permisos_que_no_tiene').message).toBe(
        'No puede dar permisos que usted no tiene',
      );
      expect(new EscaladaError('solo_administrador').message).toBe(
        'Solo un administrador puede dar o quitar el rol Administrador',
      );
    });
  });

  describe('qué roles puede dar (6.12b0)', () => {
    it('un administrador, todos (también el Administrador)', () => {
      for (const rol of [ADMINISTRADOR, CAJA, CONTADOR, SIN_PERMISOS]) {
        expect(ReglasDeEscalada.puedeDarRol(ADMIN, rol)).toBe(true);
      }
    });

    it('quien no lo es: los que tienen solo permisos suyos (o ninguno), nunca el Administrador', () => {
      expect(ReglasDeEscalada.puedeDarRol(JEFA, CAJA)).toBe(true);
      expect(ReglasDeEscalada.puedeDarRol(JEFA, SIN_PERMISOS)).toBe(true);
      expect(ReglasDeEscalada.puedeDarRol(JEFA, CONTADOR)).toBe(false);
      expect(ReglasDeEscalada.puedeDarRol(JEFA, ADMINISTRADOR)).toBe(false);
    });
  });

  describe('cambio de permisos de un rol (AUTH-D11 (2))', () => {
    const cambiar = (quien: QuienActua, rol: RolConPermisos, nuevos: string[]) => () =>
      ReglasDeEscalada.revisarCambioDePermisosDeRol({ quien, rol, nuevos });

    it('el rol Administrador no se edita, ni por un administrador', () => {
      expect(cambiar(ADMIN, ADMINISTRADOR, ['auth.usuario.ver'])).toThrow(
        RolAdministradorFijoError,
      );
    });

    it('el administrador agrega cualquiera', () => {
      expect(cambiar(ADMIN, CAJA, ['contabilidad.asiento.crear'])).not.toThrow();
    });

    it('quien no es administrador solo agrega los que tiene; quitar o dejar, cualquiera', () => {
      expect(cambiar(JEFA, CAJA, ['ventas.factura.crear', 'auth.usuario.ver'])).not.toThrow();
      expect(motivo(cambiar(JEFA, CAJA, ['contabilidad.asiento.crear']))).toBe(
        'permisos_que_no_tiene',
      );
      expect(cambiar(JEFA, CONTADOR, [])).not.toThrow();
      expect(
        cambiar(JEFA, CONTADOR, ['contabilidad.asiento.crear', 'auth.usuario.ver']),
      ).not.toThrow();
    });
  });

  describe('reactivar un rol (decisión del usuario, 6.7b)', () => {
    const reactivar = (quien: QuienActua, rol: RolConPermisos) => () =>
      ReglasDeEscalada.revisarReactivacionDeRol({ quien, rol });

    it('el administrador reactiva cualquiera', () => {
      expect(reactivar(ADMIN, CONTADOR)).not.toThrow();
    });

    it('quien no es administrador, solo si tiene todos sus permisos', () => {
      expect(reactivar(JEFA, CAJA)).not.toThrow();
      expect(reactivar(JEFA, SIN_PERMISOS)).not.toThrow();
      expect(motivo(reactivar(JEFA, CONTADOR))).toBe('permisos_que_no_tiene');
    });
  });

  describe('que quede un administrador (AUTH-D11 (4))', () => {
    it('con uno o más, sí; con ninguno, no', () => {
      expect(() => ReglasDeEscalada.revisarQueQuedeAdministrador(1)).not.toThrow();
      expect(() => ReglasDeEscalada.revisarQueQuedeAdministrador(0)).toThrow(
        UltimoAdministradorError,
      );
      expect(new UltimoAdministradorError().message).toBe(
        'La empresa no puede quedarse sin administrador',
      );
    });
  });

  describe('cambio de la persona (AUTH-D12)', () => {
    const revisar = (empresasDelUsuario: string[], empresasDondePuede: string[]) => () =>
      ReglasDeEscalada.revisarCambioDePersona({ empresasDelUsuario, empresasDondePuede });

    it('solo si puede en todas las empresas del usuario', () => {
      expect(revisar(['a'], ['a'])).not.toThrow();
      expect(revisar(['a', 'b'], ['b', 'a', 'c'])).not.toThrow();
      expect(revisar(['a', 'b'], ['a'])).toThrow(UsuarioDeOtraEmpresaError);
    });
  });
  describe('contraseña temporal, desactivar o reactivar a alguien (decisión del usuario, 6.7e)', () => {
    const admin = { esAdministrador: true, permisos: [] };
    const jefa = { esAdministrador: false, permisos: ['a', 'b'] };
    const conA = { esAdministrador: false, permisos: ['a'] };
    const conC = { esAdministrador: false, permisos: ['a', 'c'] };
    type Poder = typeof jefa;
    const revisar =
      (daSuPoder: boolean, ...empresas: [Poder, Poder][]) =>
      () =>
        ReglasDeEscalada.revisarAccionSobrePersona({
          daSuPoder,
          empresas: empresas.map(([quien, usuario]) => ({ quien, usuario })),
        });

    it('con permisos que son parte de los suyos, sí; con uno de más, no (si da su poder)', () => {
      expect(revisar(true, [jefa, conA])).not.toThrow();
      expect(motivo(revisar(true, [jefa, conC]))).toBe('mas_permisos');
      // Desactivar no da poder: con uno de más se puede.
      expect(revisar(false, [jefa, conC])).not.toThrow();
    });

    it('a un administrador solo lo toca otro administrador, en cualquier caso', () => {
      expect(motivo(revisar(true, [jefa, admin]))).toBe('administrador_de_otro');
      expect(motivo(revisar(false, [jefa, admin]))).toBe('administrador_de_otro');
      expect(revisar(true, [admin, admin])).not.toThrow();
      expect(revisar(false, [admin, admin])).not.toThrow();
    });

    it('se revisa en cada empresa: el administrador de una pasa ahí, no en la otra', () => {
      expect(revisar(true, [admin, conC], [jefa, conA])).not.toThrow();
      expect(motivo(revisar(true, [admin, conC], [jefa, conC]))).toBe('mas_permisos');
      expect(revisar(true)).not.toThrow();
    });

    it('los mensajes', () => {
      expect(new EscaladaError('propia_contrasena').message).toBe(
        'Para cambiar su propia contraseña use «Cambiar contraseña»',
      );
      expect(new EscaladaError('desactivarse').message).toBe(
        'No puede desactivar su propio usuario',
      );
      expect(new EscaladaError('administrador_de_otro').message).toBe(
        'Solo un administrador puede hacer este cambio a otro administrador',
      );
      expect(new EscaladaError('mas_permisos').message).toBe(
        'No puede hacer este cambio a alguien que tiene permisos que usted no tiene',
      );
    });
  });
});
