import {
  EscaladaError,
  RolAdministradorFijoError,
  UltimoAdministradorError,
  UsuarioDeOtraEmpresaError,
} from '../errors/auth.errors.js';

/** Quién hace el cambio, en su empresa activa. */
export interface QuienActua {
  readonly usuarioId: string;
  /** Tiene el rol Administrador de la empresa activa (AUTH-D10). */
  readonly esAdministrador: boolean;
  /** Sus permisos vigentes en la empresa activa (con los del Administrador no hace falta mirar). */
  readonly permisos: readonly string[];
}

/** Un rol de la empresa activa, con sus permisos vigentes. */
export interface RolConPermisos {
  readonly id: string;
  readonly esAdministrador: boolean;
  readonly permisos: readonly string[];
}

export interface CambioDeRoles {
  readonly quien: QuienActua;
  /** El usuario al que se le fijan los roles. */
  readonly usuarioId: string;
  /** Sus roles de ahora en la empresa activa. */
  readonly actuales: readonly RolConPermisos[];
  /** Los que quedará teniendo (la lista completa, como `PUT /usuarios/:id/roles`). */
  readonly nuevos: readonly RolConPermisos[];
}

export interface CambioDePermisosDeRol {
  readonly quien: QuienActua;
  readonly rol: RolConPermisos;
  /** Los que quedará teniendo (la lista completa, como `PUT /roles/:id/permisos`). */
  readonly nuevos: readonly string[];
}

export interface ReactivacionDeRol {
  readonly quien: QuienActua;
  /** El rol desactivado, con los permisos que volverá a dar. */
  readonly rol: RolConPermisos;
}

/** Lo que alguien puede en una empresa. */
export interface PoderEnEmpresa {
  /** Tiene el rol Administrador (activo) de esa empresa. */
  readonly esAdministrador: boolean;
  /** Sus permisos vigentes en esa empresa (con roles activos). */
  readonly permisos: readonly string[];
}

export interface AccionSobrePersona {
  /** En cada empresa activa del usuario afectado: lo que puede quien actúa y lo que puede él. */
  readonly empresas: readonly {
    readonly quien: PoderEnEmpresa;
    readonly usuario: PoderEnEmpresa;
  }[];
  /**
   * `true` si la acción le da (o le devuelve) a alguien el poder del usuario: una contraseña
   * temporal (quien la pide puede entrar como él) o reactivarlo. `false` si se lo quita
   * (desactivar): ahí solo cuenta el Administrador.
   */
  readonly daSuPoder: boolean;
}

export interface CambioDePersona {
  /** Las empresas donde trabaja el usuario afectado (donde tiene algún rol). */
  readonly empresasDelUsuario: readonly string[];
  /** Las empresas donde quien actúa tiene el permiso de ese cambio (o es Administrador). */
  readonly empresasDondePuede: readonly string[];
}

/**
 * AUTH-D11 y AUTH-D12: nadie consigue, ni da a otro, más poder del que tiene. Reglas puras:
 * los casos de uso del 6.7 juntan los datos y las llaman antes de escribir. Cada una lanza su
 * error y no devuelve nada si se puede.
 *
 * Decisiones del usuario (6.6b): dar **o quitar** el rol Administrador es solo de un
 * administrador; «solo lo que usted tiene» se revisa al **dar** (quitar nunca da más poder).
 */
export const ReglasDeEscalada = {
  /** Fijar los roles de un usuario en la empresa activa: AUTH-D11 (1), (2) y (3). */
  revisarCambioDeRoles({ quien, usuarioId, actuales, nuevos }: CambioDeRoles): void {
    if (quien.usuarioId === usuarioId) {
      throw new EscaladaError('propios_roles');
    }
    if (quien.esAdministrador) {
      return;
    }
    const dados = nuevos.filter((rol) => !actuales.some((a) => a.id === rol.id));
    const quitados = actuales.filter((rol) => !nuevos.some((n) => n.id === rol.id));
    if ([...dados, ...quitados].some((rol) => rol.esAdministrador)) {
      throw new EscaladaError('solo_administrador');
    }
    if (dados.some((rol) => !ReglasDeEscalada.puedeDarRol(quien, rol))) {
      throw new EscaladaError('permisos_que_no_tiene');
    }
  },

  /**
   * ¿Puede dar este rol a otro? AUTH-D11 (2) y (3): un administrador, cualquiera; quien no lo es,
   * nunca el Administrador y solo los roles cuyos permisos tiene todos. Es lo mismo que revisa
   * `revisarCambioDeRoles()` al dar, para que la pantalla bloquee lo mismo que rechaza la API
   * (6.12b0). No mira si el rol está activo: eso lo decide quien junta la lista.
   */
  puedeDarRol(quien: QuienActua, rol: RolConPermisos): boolean {
    if (quien.esAdministrador) {
      return true;
    }
    return !rol.esAdministrador && contieneTodos(quien.permisos, rol.permisos);
  },

  /** Fijar los permisos de un rol: el Administrador no se edita, y AUTH-D11 (2) al agregar. */
  revisarCambioDePermisosDeRol({ quien, rol, nuevos }: CambioDePermisosDeRol): void {
    if (rol.esAdministrador) {
      throw new RolAdministradorFijoError();
    }
    if (quien.esAdministrador) {
      return;
    }
    const agregados = nuevos.filter((codigo) => !rol.permisos.includes(codigo));
    if (!contieneTodos(quien.permisos, agregados)) {
      throw new EscaladaError('permisos_que_no_tiene');
    }
  },

  /**
   * Reactivar un rol devuelve sus permisos a todos los que lo tienen: quien no es administrador
   * tiene que tenerlos todos, como al agregarlos (decisión del usuario, 6.7b).
   */
  revisarReactivacionDeRol({ quien, rol }: ReactivacionDeRol): void {
    if (quien.esAdministrador) {
      return;
    }
    if (!contieneTodos(quien.permisos, rol.permisos)) {
      throw new EscaladaError('permisos_que_no_tiene');
    }
  },

  /**
   * AUTH-D11 (4): después del cambio (quitar el rol, desactivar o quitar el acceso a alguien),
   * la empresa tiene que seguir con al menos un administrador activo.
   */
  revisarQueQuedeAdministrador(administradoresActivosDespues: number): void {
    if (administradoresActivosDespues < 1) {
      throw new UltimoAdministradorError();
    }
  },

  /**
   * Contraseña temporal, desactivar o reactivar a alguien (decisión del usuario, 6.7e): en cada
   * empresa suya, a un administrador solo lo toca otro administrador y, si la acción da su
   * poder, quien actúa tiene que tener todos sus permisos. Quien es administrador ahí, pasa.
   */
  revisarAccionSobrePersona({ empresas, daSuPoder }: AccionSobrePersona): void {
    for (const { quien, usuario } of empresas) {
      if (quien.esAdministrador) {
        continue;
      }
      if (usuario.esAdministrador) {
        throw new EscaladaError('administrador_de_otro');
      }
      if (daSuPoder && !contieneTodos(quien.permisos, usuario.permisos)) {
        throw new EscaladaError('mas_permisos');
      }
    }
  },

  /**
   * AUTH-D12: lo que es de la persona (nombre, contraseña temporal, desactivar) solo lo cambia
   * quien tiene ese permiso en **todas** las empresas del usuario.
   */
  revisarCambioDePersona({ empresasDelUsuario, empresasDondePuede }: CambioDePersona): void {
    if (!contieneTodos(empresasDondePuede, empresasDelUsuario)) {
      throw new UsuarioDeOtraEmpresaError();
    }
  },
} as const;

function contieneTodos(tiene: readonly string[], pedidos: readonly string[]): boolean {
  const conjunto = new Set(tiene);
  return pedidos.every((p) => conjunto.has(p));
}
