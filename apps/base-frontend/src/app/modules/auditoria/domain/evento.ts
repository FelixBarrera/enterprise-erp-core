/** Una fila de la bitácora (`GET /auditoria/eventos`), sin el antes y el después (AUD-D10). */
export interface EventoResumen {
  readonly id: string;
  /** Instante (ISO, en UTC): se muestra en la zona del negocio. */
  readonly ocurridoEn: string;
  /** `null`: un proceso del sistema. */
  readonly usuarioId: string | null;
  /** Cómo se llamaba quien lo hizo en ese momento. */
  readonly nombreUsuario: string | null;
  /** `modulo.recurso.accion`; el texto, con `textoAccion()`. */
  readonly accion: string;
  /** Sobre qué tipo de registro (`usuario`, `rol`, `empresa`, `sesion`). */
  readonly entidad: string | null;
  readonly entidadId: string | null;
  /** Cómo se llamaba el registro en ese momento; `null` en los eventos de antes del 6.12c0b. */
  readonly entidadNombre: string | null;
}

/** Un valor de `antes` o `despues`, tal como lo guarda la bitácora (`jsonb`). */
export type ValorJson =
  string | number | boolean | null | readonly ValorJson[] | { readonly [campo: string]: ValorJson };

/** `antes` o `despues`: solo los campos que cambiaron (los sensibles, `[OCULTO]`). */
export type CambiosEvento = Readonly<Record<string, ValorJson>>;

/** Un evento completo (`GET /auditoria/eventos/:id`): con el antes, el después y desde dónde. */
export interface EventoDetalle extends EventoResumen {
  /** Cómo estaban los campos que cambiaron; `null` si se creó algo o no cambió datos. */
  readonly antes: CambiosEvento | null;
  /** Cómo quedaron; `null` si no cambió datos (un ingreso). */
  readonly despues: CambiosEvento | null;
  readonly ip: string | null;
  readonly navegador: string | null;
  /** El N.º de petición, para buscarla en los registros del servidor. */
  readonly requestId: string | null;
}

/** Una persona del filtro «Usuario» (`GET /auditoria/usuarios`): hizo algo en la empresa. */
export interface UsuarioDeBitacora {
  readonly usuarioId: string;
  readonly nombreUsuario: string;
}

/** Quién lo hizo: su usuario o, si fue un proceso del servidor, «El sistema». */
export function textoQuien(evento: EventoResumen): string {
  return evento.nombreUsuario ?? 'El sistema';
}

interface TipoDeRegistro {
  /** «Usuario jorge.vera». */
  readonly conNombre: (nombre: string) => string;
  /** Sin el nombre (eventos viejos): «Un usuario». */
  readonly sinNombre: string;
}

const TIPOS: Readonly<Record<string, TipoDeRegistro>> = {
  usuario: { conNombre: (n) => `Usuario ${n}`, sinNombre: 'Un usuario' },
  rol: { conNombre: (n) => `Rol ${n}`, sinNombre: 'Un rol' },
  empresa: { conNombre: (n) => `Empresa ${n}`, sinNombre: 'La empresa' },
  sesion: { conNombre: (n) => `Sesión de ${n}`, sinNombre: 'Una sesión' },
};

/**
 * La columna «Sobre qué»: «Usuario jorge.vera», «Rol Contabilidad». Sin el nombre (eventos de
 * antes del 6.12c0b), «Un usuario». Sin registro, `''`. Un tipo que la pantalla no conoce, con su
 * nombre o su código.
 */
export function textoSobreQue(evento: EventoResumen): string {
  if (evento.entidad === null) return '';
  const tipo = TIPOS[evento.entidad] as TipoDeRegistro | undefined;
  const nombre = evento.entidadNombre;
  if (tipo === undefined) return nombre ?? evento.entidad;
  return nombre === null ? tipo.sinNombre : tipo.conNombre(nombre);
}
