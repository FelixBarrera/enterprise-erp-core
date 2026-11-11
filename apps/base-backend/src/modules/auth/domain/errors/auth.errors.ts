import { DomainError, TipoErrorDominio } from '../../../../shared/domain/errors/domain-error.js';
import {
  MENSAJE_DEBE_CAMBIAR_CONTRASENA,
  MENSAJE_SESION_TERMINO,
  MENSAJE_SIN_PERMISO,
} from '../../../../shared/domain/errors/mensajes-acceso.js';

/** Nombre de usuario vacío o con caracteres no permitidos (→ 400). */
export class NombreUsuarioInvalidoError extends DomainError {
  constructor(mensaje: string) {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}

/** Nombre completo vacío o demasiado largo (→ 400). */
export class NombreCompletoInvalidoError extends DomainError {
  constructor(mensaje: string) {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}

/** Nombre o descripción de rol vacíos o demasiado largos (→ 400). */
export class NombreRolInvalidoError extends DomainError {
  constructor(mensaje: string) {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}

/** Un código de permiso sin el formato `modulo.recurso.accion` (→ 400). */
export class CodigoPermisoInvalidoError extends DomainError {
  constructor(codigo: string) {
    super(
      TipoErrorDominio.VALIDACION,
      `El permiso «${codigo.slice(0, 100)}» no tiene el formato modulo.recurso.accion`,
    );
  }
}

/** La contraseña nueva no cumple las reglas; un mensaje por motivo (→ 400). */
export class ContrasenaDebilError extends DomainError {
  constructor(mensaje: string) {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}

/** Ese nombre de usuario ya existe, aunque esté desactivado: nunca se reutiliza (AUTH-D3, → 409). */
export class NombreUsuarioDuplicadoError extends DomainError {
  constructor() {
    super(
      TipoErrorDominio.CONFLICTO,
      'Ese nombre de usuario ya existe (aunque esté desactivado, no se vuelve a usar). Elija otro',
    );
  }
}

/** Ya hay un rol activo con ese nombre en la empresa, sin importar mayúsculas ni tildes (→ 409). */
export class NombreRolDuplicadoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.CONFLICTO, 'Ya existe un rol con ese nombre');
  }
}

/** El rol Administrador no se edita ni se desactiva (AUTH-D10, → 422). */
export class RolAdministradorFijoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.REGLA_NEGOCIO, 'El rol Administrador no se puede cambiar');
  }
}

/**
 * No hay un rol con ese id **en la empresa activa** (un rol de otra empresa tampoco existe para
 * quien opera, → 404).
 */
export class RolNoEncontradoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.NO_ENCONTRADO, 'El rol no existe');
  }
}

/** Un código que no está entre los permisos vigentes del catálogo (→ 400). */
export class PermisoDesconocidoError extends DomainError {
  constructor(codigo: string) {
    super(TipoErrorDominio.VALIDACION, `El permiso «${codigo.slice(0, 100)}» no existe`);
  }
}

/**
 * Uno de los roles elegidos para un usuario no existe **en la empresa activa** (uno de otra
 * empresa tampoco existe para quien opera, → 400).
 */
export class RolDesconocidoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.VALIDACION, 'Alguno de los roles elegidos no existe');
  }
}

/**
 * Se pidió dar a alguien un rol desactivado (no da permisos). El que ya lo tenía puede
 * quedárselo al fijar sus roles (decisión del usuario, 6.7d, → 422).
 */
export class RolDesactivadoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.REGLA_NEGOCIO, 'No se puede dar un rol desactivado');
  }
}

/**
 * Crear o fijar roles sin ningún rol (→ 400). Un usuario sin roles no se ve en la
 * empresa; quitarle todos es «Quitar acceso», que además cierra sus sesiones (decisión del
 * usuario, 6.7c).
 */
export class SinRolesError extends DomainError {
  constructor(mensaje: string) {
    super(TipoErrorDominio.VALIDACION, mensaje);
  }
}

/**
 * No hay ningún usuario con ese nombre (los comandos), o con ese id **en la empresa activa** (un
 * usuario sin ningún rol en ella tampoco existe para quien opera, 6.7c) (→ 404).
 */
export class UsuarioNoEncontradoError extends DomainError {
  constructor(nombreUsuario?: string) {
    super(
      TipoErrorDominio.NO_ENCONTRADO,
      nombreUsuario === undefined
        ? 'El usuario no existe'
        : `No existe el usuario «${nombreUsuario}»`,
    );
  }
}

/** El usuario está desactivado: no puede recibir roles (una empresa quedaría sin administrador activo, → 422). */
export class UsuarioInactivoError extends DomainError {
  constructor(nombreUsuario: string) {
    super(TipoErrorDominio.REGLA_NEGOCIO, `El usuario «${nombreUsuario}» está desactivado`);
  }
}

/**
 * Login fallido, por el motivo que sea (no existe, contraseña mal, bloqueado o desactivado):
 * siempre el mismo mensaje, para no decir si el usuario existe (AUTH-D15, → 401).
 */
export class CredencialesInvalidasError extends DomainError {
  constructor() {
    super(
      TipoErrorDominio.NO_AUTENTICADO,
      'Credenciales inválidas. Si falló varias veces, espere 15 minutos o pida ayuda al administrador.',
    );
  }
}

/** Contraseña correcta, pero sin ningún rol en una empresa activa (AUTH-D16, → 403). */
export class SinEmpresaError extends DomainError {
  constructor() {
    super(
      TipoErrorDominio.NO_AUTORIZADO,
      'Su usuario no tiene acceso a ninguna empresa. Pida ayuda al administrador.',
    );
  }
}

/** La sesión venció, se cerró o el token no sirve (→ 401). */
export class SesionInvalidaError extends DomainError {
  constructor() {
    super(TipoErrorDominio.NO_AUTENTICADO, MENSAJE_SESION_TERMINO);
  }
}

/**
 * Tiene una contraseña temporal y la ruta no es de las que se pueden usar así: ver la sesión,
 * cambiar la contraseña, refresh y salir (AUTH-D14, → 403).
 */
export class DebeCambiarContrasenaError extends DomainError {
  constructor() {
    super(TipoErrorDominio.NO_AUTORIZADO, MENSAJE_DEBE_CAMBIAR_CONTRASENA);
  }
}

/**
 * La petición que usa la cookie de la sesión no viene de un sitio de `CORS_ORIGINS` (o no dice
 * de dónde viene): protección contra CSRF en refresh y logout (→ 403).
 */
export class OrigenNoPermitidoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.NO_AUTORIZADO, 'La petición no viene de un sitio permitido');
  }
}

/** Al cambiar la contraseña, la actual que escribió no es la suya (→ 400). Cuenta como fallo. */
export class ContrasenaActualIncorrectaError extends DomainError {
  constructor() {
    super(TipoErrorDominio.VALIDACION, 'La contraseña actual no es correcta');
  }
}

/**
 * Al cambiar la contraseña, la cuenta está bloqueada por intentos fallidos: no se revisa lo que
 * escribió hasta que pase el bloqueo (así nadie sigue probando desde una sesión abierta) (→ 403).
 */
export class CuentaBloqueadaError extends DomainError {
  constructor() {
    super(
      TipoErrorDominio.NO_AUTORIZADO,
      'Demasiados intentos fallidos. Espere 15 minutos o pida ayuda al administrador.',
    );
  }
}

/**
 * Pidió pasar a una empresa en la que no tiene un rol activo, o que está desactivada (o que no
 * existe: no se distingue) (→ 403).
 */
export class SinAccesoEmpresaError extends DomainError {
  constructor() {
    super(TipoErrorDominio.NO_AUTORIZADO, 'No tiene acceso a esa empresa');
  }
}

/** La ruta pide un permiso que no tiene en la empresa activa (`@RequierePermiso()`, → 403). */
export class SinPermisoError extends DomainError {
  constructor() {
    super(TipoErrorDominio.NO_AUTORIZADO, MENSAJE_SIN_PERMISO);
  }
}

/** Por qué un cambio de roles, de permisos o sobre una persona sería una escalada (AUTH-D11). */
export type MotivoEscalada =
  | 'propios_roles'
  | 'permisos_que_no_tiene'
  | 'solo_administrador'
  | 'propia_contrasena'
  | 'desactivarse'
  | 'administrador_de_otro'
  | 'mas_permisos';

const MENSAJES_ESCALADA: Record<MotivoEscalada, string> = {
  propios_roles: 'No puede cambiar sus propios roles',
  permisos_que_no_tiene: 'No puede dar permisos que usted no tiene',
  solo_administrador: 'Solo un administrador puede dar o quitar el rol Administrador',
  // 6.7e (decisiones del usuario, 2026-11-06).
  propia_contrasena: 'Para cambiar su propia contraseña use «Cambiar contraseña»',
  desactivarse: 'No puede desactivar su propio usuario',
  administrador_de_otro: 'Solo un administrador puede hacer este cambio a otro administrador',
  mas_permisos: 'No puede hacer este cambio a alguien que tiene permisos que usted no tiene',
};

/** Un cambio de roles o de permisos daría más poder del que tiene quien lo hace (AUTH-D11, → 403). */
export class EscaladaError extends DomainError {
  constructor(readonly motivo: MotivoEscalada) {
    super(TipoErrorDominio.NO_AUTORIZADO, MENSAJES_ESCALADA[motivo]);
  }
}

/**
 * Un cambio de la persona (nombre, contraseña temporal, desactivar) sobre alguien que también
 * trabaja en una empresa donde quien lo hace no tiene ese permiso (AUTH-D12, → 403).
 */
export class UsuarioDeOtraEmpresaError extends DomainError {
  constructor() {
    super(
      TipoErrorDominio.NO_AUTORIZADO,
      'Este usuario también trabaja en otra empresa: solo puede hacer este cambio quien lo administre en todas',
    );
  }
}

/** El cambio dejaría a la empresa sin ningún administrador activo (AUTH-D11 (4), → 422). */
export class UltimoAdministradorError extends DomainError {
  constructor() {
    super(TipoErrorDominio.REGLA_NEGOCIO, 'La empresa no puede quedarse sin administrador');
  }
}
