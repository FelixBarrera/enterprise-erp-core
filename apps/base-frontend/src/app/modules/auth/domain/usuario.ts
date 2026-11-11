/** Cuándo y quién, de la bitácora de la empresa (`por: null`: lo hizo el sistema). */
export interface HuellaUsuario {
  readonly en: string;
  readonly por: string | null;
}

/** Un rol del usuario en la empresa activa. */
export interface RolDeUsuario {
  readonly id: string;
  readonly nombre: string;
  readonly esAdministrador: boolean;
  /** Un rol desactivado no da permisos (el usuario lo conserva). */
  readonly activo: boolean;
}

/** Una sesión abierta del usuario en la empresa activa. */
export interface SesionDeUsuario {
  readonly id: string;
  readonly iniciadaEn: string;
  readonly ultimoUsoEn: string;
  readonly ip: string | null;
  /** El `User-Agent` tal como llegó. */
  readonly navegador: string | null;
}

/** Una fila de la lista de usuarios (`GET /usuarios`). */
export interface UsuarioResumen {
  readonly id: string;
  /** Con lo que entra; no cambia. */
  readonly nombreUsuario: string;
  readonly nombreCompleto: string;
  /** Un usuario desactivado no entra en ninguna empresa. */
  readonly activo: boolean;
  /** Bloqueado por intentos fallidos hasta ese instante; `null` si no lo está. */
  readonly bloqueadoHasta: string | null;
  readonly ultimoIngresoEn: string | null;
  readonly roles: readonly RolDeUsuario[];
  /** Tiene una contraseña temporal que todavía no cambió. */
  readonly debeCambiarContrasena: boolean;
}

/** La ficha de un usuario (`GET /usuarios/:id` y lo que responden sus cambios). */
export interface Usuario extends UsuarioResumen {
  /** Tiene roles en otra empresa: su nombre solo lo cambia quien lo administra en todas. */
  readonly trabajaEnOtrasEmpresas: boolean;
  /** La usada más hace poco, primero. */
  readonly sesiones: readonly SesionDeUsuario[];
  /** Cuándo entró a esta empresa (lo crearon o le dieron acceso) y quién. */
  readonly creado: HuellaUsuario | null;
  readonly modificado: HuellaUsuario | null;
}

/** Un rol de `GET /usuarios/roles-asignables`: los activos, el Administrador primero. */
export interface RolAsignable {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly esAdministrador: boolean;
  /** Quien opera lo puede dar (lo decide el backend con la misma regla con que lo revisa). */
  readonly sePuedeDar: boolean;
}

/** Lo que responde «Quitar acceso». */
export interface AccesoQuitado {
  readonly id: string;
  readonly sesionesCerradas: number;
}

/** Lo que responde «Cerrar sus sesiones»: cuántas cerró, en todas sus empresas. */
export interface SesionesCerradas {
  readonly id: string;
  readonly sesionesCerradas: number;
}

/** Las acciones del menú «Acciones» de la ficha, en el orden en que se ven. */
export const ACCIONES_USUARIO = [
  'reactivar',
  'desbloquear',
  'contrasena-temporal',
  'cerrar-sesiones',
  'quitar-acceso',
  'desactivar',
] as const;
export type AccionUsuario = (typeof ACCIONES_USUARIO)[number];

/** Lo que pesa al elegir las acciones: de quien opera y de la ficha. */
export interface ReglaAccionesUsuario {
  /** Es la ficha de quien opera. */
  readonly esSuFicha: boolean;
  /** `auth.usuario.restablecer`: contraseña temporal, desbloquear y cerrar sesiones. */
  readonly puedeRestablecer: boolean;
  /** `auth.usuario.desactivar`: desactivar y reactivar. */
  readonly puedeDesactivar: boolean;
  /** `auth.usuario.asignar_roles`. */
  readonly puedeQuitarAcceso: boolean;
}

/** Las que quitan algo: van en rojo y después de una línea. */
export function esAccionDePeligro(accion: AccionUsuario): boolean {
  return accion === 'quitar-acceso' || accion === 'desactivar';
}

/**
 * Las acciones que tienen sentido para este usuario (el backend vuelve a revisar todo, también la
 * escalada). Sobre sí mismo: solo desbloquear y cerrar las otras sesiones (la contraseña la cambia
 * con «Cambiar contraseña»; nadie se desactiva ni se quita el acceso). Desactivado: solo reactivar
 * y quitar el acceso (no entra, así que no hay sesiones ni contraseña que dar).
 */
export function accionesDeUsuario(usuario: Usuario, regla: ReglaAccionesUsuario): AccionUsuario[] {
  const aplica: Record<AccionUsuario, boolean> = {
    reactivar: regla.puedeDesactivar && !usuario.activo,
    desbloquear: regla.puedeRestablecer && usuario.activo && usuario.bloqueadoHasta !== null,
    'contrasena-temporal': regla.puedeRestablecer && usuario.activo && !regla.esSuFicha,
    'cerrar-sesiones': regla.puedeRestablecer && usuario.activo,
    'quitar-acceso': regla.puedeQuitarAcceso && !regla.esSuFicha,
    desactivar: regla.puedeDesactivar && usuario.activo && !regla.esSuFicha,
  };
  return ACCIONES_USUARIO.filter((accion) => aplica[accion]);
}

/** El aviso al terminar «Cerrar sus sesiones». */
export function textoSesionesCerradas(cantidad: number, esSuFicha: boolean): string {
  if (esSuFicha) {
    if (cantidad === 0) return 'No tenía otras sesiones abiertas';
    return cantidad === 1
      ? 'Se cerró su otra sesión'
      : `Se cerraron sus otras ${cantidad} sesiones`;
  }
  if (cantidad === 0) return 'No tenía sesiones abiertas';
  return cantidad === 1 ? 'Se cerró 1 sesión' : `Se cerraron ${cantidad} sesiones`;
}

/** Los mismos topes que el backend (`NombreCompleto`, `NombreUsuario`, `ListarUsuariosQueryDto`). */
export const LARGO_MAXIMO_NOMBRE_COMPLETO = 150;
export const LARGO_MAXIMO_BUSQUEDA_USUARIO = 150;
export const LARGO_MAXIMO_NOMBRE_USUARIO = 50;

/** La misma regla que `NombreUsuario` del backend (AUTH-D3), ya recortado y en minúsculas. */
const FORMATO_NOMBRE_USUARIO = /^[a-z0-9._-]{3,50}$/u;

/** Como lo guarda el backend: sin espacios en los extremos y en minúsculas. */
export function normalizarNombreUsuario(texto: string): string {
  return texto.trim().toLowerCase();
}

/** `Lucia.Torres` vale (el backend lo pasa a minúsculas); `lucía` o `ab`, no. */
export function esNombreUsuarioValido(texto: string): boolean {
  return FORMATO_NOMBRE_USUARIO.test(normalizarNombreUsuario(texto));
}

/** `POST /usuarios`: el usuario se crea con estos roles en la empresa activa. */
export interface UsuarioNuevo {
  readonly nombreUsuario: string;
  readonly nombreCompleto: string;
  readonly roles: readonly string[];
}

/** Lo que responde `POST /usuarios`: la contraseña temporal se ve esta sola vez (AUTH-D13). */
export interface UsuarioCreado {
  readonly usuario: Usuario;
  readonly contrasenaTemporal: string;
}

/** «Estado» en los filtros de la lista. */
export const ESTADOS_USUARIO = ['todos', 'activos', 'desactivados'] as const;
export type EstadoFiltroUsuario = (typeof ESTADOS_USUARIO)[number];

export interface FiltrosUsuarios {
  /** Parte del nombre o del usuario (sin mayúsculas ni tildes: lo resuelve el backend). */
  readonly texto: string;
  /** El id de un rol; `''`, todos. */
  readonly rol: string;
  readonly estado: EstadoFiltroUsuario;
}

export const FILTROS_USUARIOS_INICIALES: FiltrosUsuarios = { texto: '', rol: '', estado: 'todos' };

/** Una insignia de estado: el texto dice el estado; `tipo` es el color (`.estado--…`). */
export interface EstadoUsuario {
  readonly texto: string;
  readonly tipo: 'exito' | 'neutro' | 'aviso' | 'peligro';
}

/**
 * Las insignias de un usuario: «Desactivado» sola (no entra en ninguna parte); si no, «Bloqueado» y
 * «Debe cambiar su contraseña» (solo en la ficha: la lista no lo trae); sin nada de eso, «Activo».
 */
export function estadosDeUsuario(usuario: UsuarioResumen | Usuario): EstadoUsuario[] {
  if (!usuario.activo) return [{ texto: 'Desactivado', tipo: 'neutro' }];
  const estados: EstadoUsuario[] = [];
  if (usuario.bloqueadoHasta !== null) estados.push({ texto: 'Bloqueado', tipo: 'peligro' });
  if (usuario.debeCambiarContrasena) {
    estados.push({ texto: 'Debe cambiar su contraseña', tipo: 'aviso' });
  }
  return estados.length === 0 ? [{ texto: 'Activo', tipo: 'exito' }] : estados;
}

/** El nombre del rol en la lista: «Operaciones (desactivado)». */
export function textoRolDeUsuario(rol: RolDeUsuario): string {
  return rol.activo ? rol.nombre : `${rol.nombre} (desactivado)`;
}

/** Los roles en una línea, para la tarjeta del celular: «Jefe de oficina · Consulta». */
export function textoRolesDeUsuario(roles: readonly RolDeUsuario[]): string {
  return roles.map(textoRolDeUsuario).join(' · ');
}

/** Lo que se manda en `PATCH /usuarios/:id`: solo lo que cambió. */
export interface CambiosUsuario {
  readonly nombreCompleto?: string;
}

/** Lo que cambió en «Datos» (los espacios de los extremos no cuentan). Sin cambios, `null`. */
export function cambiosDeUsuario(usuario: Usuario, nombreCompleto: string): CambiosUsuario | null {
  return nombreCompleto.trim() === usuario.nombreCompleto ? null : { nombreCompleto };
}

/** Cuántos roles se agregan o se quitan (cada uno, un cambio). */
export function cantidadDeCambiosDeRoles(
  marcados: ReadonlySet<string>,
  originales: ReadonlySet<string>,
): number {
  let cambios = 0;
  for (const id of marcados) if (!originales.has(id)) cambios += 1;
  for (const id of originales) if (!marcados.has(id)) cambios += 1;
  return cambios;
}

/** Quién opera y qué puede, para la pestaña «Roles». */
export interface ReglaRolesUsuario {
  /** Tiene «Asignar roles» y no es su propia ficha. */
  readonly editable: boolean;
  /** Solo un administrador da o quita el rol Administrador. */
  readonly esAdministrador: boolean;
}

/** Una fila de la pestaña «Roles». */
export interface FilaRolUsuario {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly esAdministrador: boolean;
  /** Desactivado: solo aparece si el usuario ya lo tenía. */
  readonly desactivado: boolean;
  readonly marcado: boolean;
  readonly cambiable: boolean;
  /** A la derecha: «Se agrega», «Se quita» o por qué no se puede. */
  readonly nota: string | null;
  readonly esCambio: boolean;
}

export const NOTA_SOLO_ADMINISTRADOR_DA = 'Solo un administrador da este rol';
export const NOTA_SOLO_ADMINISTRADOR_QUITA = 'Solo un administrador quita este rol';
export const NOTA_SIN_TODOS_LOS_PERMISOS = 'Usted no tiene todos los permisos de este rol';
export const DESCRIPCION_DESACTIVADO = 'Desactivado: no da permisos mientras siga así';

/**
 * Las filas de «Roles»: los activos de la empresa (en el orden del backend) y, al final, los
 * desactivados que el usuario ya tiene (no se dan; se pueden quitar). Escalada (AUTH-D11): dar,
 * solo lo que `sePuedeDar`; quitar, cualquiera, salvo el Administrador (solo un administrador).
 * Volver a marcar lo que ya tenía siempre se puede (es deshacer).
 */
export function filasDeRoles(
  asignables: readonly RolAsignable[],
  actuales: readonly RolDeUsuario[],
  marcados: ReadonlySet<string>,
  regla: ReglaRolesUsuario,
): FilaRolUsuario[] {
  const originales = new Set(actuales.map((r) => r.id));
  const activos = asignables.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    esAdministrador: r.esAdministrador,
    desactivado: false,
    sePuedeDar: r.sePuedeDar,
  }));
  const ids = new Set(activos.map((r) => r.id));
  // Uno que tiene y no está entre los asignables está desactivado (o lo desactivaron recién).
  const desactivados = actuales
    .filter((r) => !ids.has(r.id))
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: DESCRIPCION_DESACTIVADO,
      esAdministrador: r.esAdministrador,
      desactivado: true,
      sePuedeDar: false,
    }));
  return [...activos, ...desactivados].map((r) => {
    const marcado = marcados.has(r.id);
    const original = originales.has(r.id);
    const tocaAdministrador = r.esAdministrador && !regla.esAdministrador;
    const cambiable = regla.editable && !tocaAdministrador && (marcado || original || r.sePuedeDar);
    let nota: string | null = null;
    if (marcado !== original) nota = marcado ? 'Se agrega' : 'Se quita';
    else if (regla.editable && !cambiable) {
      if (tocaAdministrador)
        nota = marcado ? NOTA_SOLO_ADMINISTRADOR_QUITA : NOTA_SOLO_ADMINISTRADOR_DA;
      else nota = NOTA_SIN_TODOS_LOS_PERMISOS;
    }
    return {
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      esAdministrador: r.esAdministrador,
      desactivado: r.desactivado,
      marcado,
      cambiable,
      nota,
      esCambio: marcado !== original,
    };
  });
}

/** Los ids marcados en el orden de las filas (para `PUT /usuarios/:id/roles`). */
export function rolesEnOrden(
  filas: readonly FilaRolUsuario[],
  marcados: ReadonlySet<string>,
): string[] {
  return filas.filter((f) => marcados.has(f.id)).map((f) => f.id);
}

/** Debajo del nombre en la ficha: «Último ingreso el …» lo pone la pantalla; sin ingreso, esto. */
export const TEXTO_SIN_INGRESO = 'Nunca entró';

const NAVEGADORES: readonly (readonly [RegExp, string])[] = [
  [/Edg(A|iOS)?\//u, 'Edge'],
  [/OPR\/|Opera/u, 'Opera'],
  [/Firefox\/|FxiOS\//u, 'Firefox'],
  [/Chrome\/|CriOS\//u, 'Chrome'],
  [/Safari\//u, 'Safari'],
];

const SISTEMAS: readonly (readonly [RegExp, string])[] = [
  [/Windows/u, 'Windows'],
  [/Android/u, 'Android'],
  [/iPhone/u, 'iPhone'],
  [/iPad/u, 'iPad'],
  [/Mac OS X|Macintosh/u, 'Mac'],
  [/CrOS/u, 'ChromeOS'],
  [/Linux/u, 'Linux'],
];

/**
 * «Chrome en Windows», del `User-Agent`. Solo para leerlo de un vistazo: debajo va el texto
 * completo. Lo que no se reconoce, «Navegador desconocido» o solo una de las dos partes.
 */
export function describirNavegador(agente: string | null): string {
  if (agente === null || agente.trim() === '') return 'Navegador desconocido';
  const navegador = NAVEGADORES.find(([patron]) => patron.test(agente))?.[1] ?? null;
  const sistema = SISTEMAS.find(([patron]) => patron.test(agente))?.[1] ?? null;
  if (navegador !== null && sistema !== null) return `${navegador} en ${sistema}`;
  return navegador ?? sistema ?? 'Navegador desconocido';
}
