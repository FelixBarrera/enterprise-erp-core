/**
 * Los textos en español de lo que registra la bitácora (AUD-D9): la API manda el código
 * (`auth.usuario.crear`) y la pantalla dice «Creó un usuario». Una acción nueva en el backend se
 * suma aquí, en su grupo; `acciones.spec.ts` tiene la lista de las que registra hoy y falla si
 * falta una.
 */

export interface AccionBitacora {
  /** `modulo.recurso.accion`, como lo guarda el backend. */
  readonly codigo: string;
  readonly texto: string;
  /** Lleva la marca roja «Seguridad» (bloqueos, ingresos fallidos). */
  readonly seguridad?: true;
}

/** Un grupo del filtro «Qué hizo» (AUD-D11: filtrar por el grupo trae todas sus acciones). */
export interface GrupoAcciones {
  /** `modulo.recurso`: el backend trae las acciones que empiezan por `grupo.`. */
  readonly codigo: string;
  readonly titulo: string;
  /** La opción del grupo entero: «Todo sobre usuarios». */
  readonly textoTodo: string;
  readonly acciones: readonly AccionBitacora[];
}

/** En el orden en que se ven en el filtro «Qué hizo». */
export const GRUPOS_ACCIONES: readonly GrupoAcciones[] = [
  {
    codigo: 'auth.usuario',
    titulo: 'Usuarios',
    textoTodo: 'Todo sobre usuarios',
    acciones: [
      { codigo: 'auth.usuario.crear', texto: 'Creó un usuario' },
      // Ya no se ofrece en la pantalla (6.12b5), pero queda en eventos viejos y en
      // `admin:crear-empresa`.
      { codigo: 'auth.usuario.dar_acceso', texto: 'Dio acceso a alguien que ya tiene usuario' },
      { codigo: 'auth.usuario.editar', texto: 'Cambió el nombre de un usuario' },
      { codigo: 'auth.usuario.asignar_roles', texto: 'Cambió los roles de un usuario' },
      { codigo: 'auth.usuario.contrasena_temporal', texto: 'Dio una contraseña temporal' },
      { codigo: 'auth.usuario.desbloquear', texto: 'Desbloqueó un usuario' },
      { codigo: 'auth.usuario.cerrar_sesiones', texto: 'Cerró las sesiones de un usuario' },
      { codigo: 'auth.usuario.quitar_acceso', texto: 'Quitó el acceso a un usuario' },
      { codigo: 'auth.usuario.desactivar', texto: 'Desactivó un usuario' },
      { codigo: 'auth.usuario.reactivar', texto: 'Reactivó un usuario' },
      { codigo: 'auth.usuario.cambiar_contrasena', texto: 'Cambió su contraseña' },
      {
        codigo: 'auth.usuario.cambiar_contrasena_fallido',
        texto: 'Intento fallido de cambiar su contraseña',
        seguridad: true,
      },
      { codigo: 'auth.usuario.bloquear', texto: 'El usuario quedó bloqueado', seguridad: true },
    ],
  },
  {
    codigo: 'auth.rol',
    titulo: 'Roles',
    textoTodo: 'Todo sobre roles',
    acciones: [
      { codigo: 'auth.rol.crear', texto: 'Creó un rol' },
      { codigo: 'auth.rol.editar', texto: 'Cambió el nombre o la descripción de un rol' },
      { codigo: 'auth.rol.permisos', texto: 'Cambió los permisos de un rol' },
      { codigo: 'auth.rol.desactivar', texto: 'Desactivó un rol' },
      { codigo: 'auth.rol.reactivar', texto: 'Reactivó un rol' },
    ],
  },
  {
    codigo: 'auth.sesion',
    titulo: 'Ingresos',
    textoTodo: 'Todo sobre ingresos',
    acciones: [
      { codigo: 'auth.sesion.iniciar', texto: 'Entró al sistema' },
      { codigo: 'auth.sesion.fallido', texto: 'Intento de ingreso fallido', seguridad: true },
      { codigo: 'auth.sesion.cambiar_empresa', texto: 'Cambió de empresa' },
      { codigo: 'auth.sesion.cerrar', texto: 'Cerró sesión' },
      {
        codigo: 'auth.sesion.reuso',
        texto: 'Se usó una sesión ya renovada y se cerraron sus sesiones',
        seguridad: true,
      },
    ],
  },
  {
    codigo: 'empresas.empresa',
    titulo: 'Empresa',
    textoTodo: 'Todo sobre la empresa',
    acciones: [
      { codigo: 'empresas.empresa.crear', texto: 'Creó la empresa' },
      { codigo: 'empresas.empresa.editar', texto: 'Cambió el nombre de la empresa' },
      { codigo: 'empresas.empresa.desactivar', texto: 'Desactivó la empresa' },
    ],
  },
];

const POR_CODIGO = new Map(GRUPOS_ACCIONES.flatMap((g) => g.acciones).map((a) => [a.codigo, a]));
const GRUPOS = new Set(GRUPOS_ACCIONES.map((g) => g.codigo));

/** «Creó un usuario». Un código que la pantalla no conoce sale tal cual: nunca queda en blanco. */
export function textoAccion(codigo: string): string {
  return POR_CODIGO.get(codigo)?.texto ?? codigo;
}

/** Bloqueos, ingresos fallidos y el reuso de una sesión: llevan la marca «Seguridad». */
export function esDeSeguridad(codigo: string): boolean {
  return POR_CODIGO.get(codigo)?.seguridad === true;
}

/** Una opción del filtro «Qué hizo»: una acción conocida o un grupo. */
export function esFiltroDeAccion(codigo: string): boolean {
  return POR_CODIGO.has(codigo) || GRUPOS.has(codigo);
}
