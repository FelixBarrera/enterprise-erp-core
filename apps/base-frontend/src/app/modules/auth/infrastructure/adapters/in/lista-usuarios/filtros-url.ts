import type { ParamMap, Params } from '@angular/router';
import {
  filtroAUrl,
  opcionDeUrl,
  textoDeUrl,
} from '../../../../../../shared/infrastructure/listados/parametros-url';
import {
  ESTADOS_USUARIO,
  FILTROS_USUARIOS_INICIALES,
  type FiltrosUsuarios,
} from '../../../../domain/usuario';

/** Un id de rol (UUID): otra cosa se ignora, para no pedirle al backend algo que rechaza. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** `?texto=perez&rol=<id>&estado=activos`: lo que no se entiende se ignora. */
export function filtrosUsuariosDeUrl(parametros: ParamMap): FiltrosUsuarios {
  const rol = textoDeUrl(parametros, 'rol');
  return {
    texto: textoDeUrl(parametros, 'texto'),
    rol: ID.test(rol) ? rol : FILTROS_USUARIOS_INICIALES.rol,
    estado: opcionDeUrl(parametros, 'estado', ESTADOS_USUARIO, FILTROS_USUARIOS_INICIALES.estado),
  };
}

/** Sin los valores iniciales: la lista sin filtros queda en `/usuarios`. */
export function filtrosUsuariosAUrl(filtros: FiltrosUsuarios): Params {
  return {
    ...filtroAUrl('texto', filtros.texto, FILTROS_USUARIOS_INICIALES.texto),
    ...filtroAUrl('rol', filtros.rol, FILTROS_USUARIOS_INICIALES.rol),
    ...filtroAUrl('estado', filtros.estado, FILTROS_USUARIOS_INICIALES.estado),
  };
}
