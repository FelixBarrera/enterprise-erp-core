/** Un registro concreto (un usuario, un rol): la bitácora muestra solo su historia. */
export interface RegistroBitacora {
  /** `usuario`, `rol`. */
  readonly entidad: string;
  readonly entidadId: string;
}

/** Los tipos de registro que tienen «Ver historia» (en su ficha y en el detalle de un evento). */
const CON_HISTORIA: Readonly<Record<string, { readonly delTipo: string; readonly deUno: string }>> =
  {
    usuario: { delTipo: 'Historia del usuario', deUno: 'Historia de un usuario' },
    rol: { delTipo: 'Historia del rol', deUno: 'Historia de un rol' },
  };

export function tieneHistoria(entidad: string | null): boolean {
  return entidad !== null && entidad in CON_HISTORIA;
}

/**
 * El comienzo del aviso de la historia: «Historia del usuario» + el nombre (en negrita), o
 * «Historia de un usuario» si no se sabe (`nombre: null`). La pantalla sigue con «: todo lo que se
 * hizo con él en esta empresa».
 */
export function textoHistoria(
  entidad: string,
  nombre: string | null,
): { readonly inicio: string; readonly nombre: string | null } {
  const tipo = CON_HISTORIA[entidad] as (typeof CON_HISTORIA)[string] | undefined;
  if (tipo === undefined) return { inicio: 'Historia de un registro', nombre: null };
  return nombre === null ? { inicio: tipo.deUno, nombre: null } : { inicio: tipo.delTipo, nombre };
}
