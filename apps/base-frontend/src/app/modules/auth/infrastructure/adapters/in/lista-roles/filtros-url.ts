import type { ParamMap, Params } from '@angular/router';
import {
  filtroAUrl,
  opcionDeUrl,
  textoDeUrl,
} from '../../../../../../shared/infrastructure/listados/parametros-url';
import { ESTADOS_ROL, FILTROS_ROLES_INICIALES, type FiltrosRoles } from '../../../../domain/rol';

/** `?texto=caja&estado=activos`: lo que no se entiende se ignora. */
export function filtrosRolesDeUrl(parametros: ParamMap): FiltrosRoles {
  return {
    texto: textoDeUrl(parametros, 'texto'),
    estado: opcionDeUrl(parametros, 'estado', ESTADOS_ROL, FILTROS_ROLES_INICIALES.estado),
  };
}

/** Sin los valores iniciales: la lista sin filtros queda en `/roles`. */
export function filtrosRolesAUrl(filtros: FiltrosRoles): Params {
  return {
    ...filtroAUrl('texto', filtros.texto, FILTROS_ROLES_INICIALES.texto),
    ...filtroAUrl('estado', filtros.estado, FILTROS_ROLES_INICIALES.estado),
  };
}
