import type { ParamMap, Params } from '@angular/router';
import { esDia } from '../../../../../../shared/domain/fechas';
import {
  filtroAUrl,
  textoDeUrl,
} from '../../../../../../shared/infrastructure/listados/parametros-url';
import { esFiltroDeAccion } from '../../../../domain/acciones';
import {
  type FiltrosBitacora,
  filtrosBitacoraIniciales,
} from '../../../../domain/filtros-bitacora';
import { type RegistroBitacora, tieneHistoria } from '../../../../domain/registro';

/** Un id de usuario (UUID): otra cosa se ignora, para no pedirle al backend algo que rechaza. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export interface FiltrosBitacoraUrl {
  readonly leer: (parametros: ParamMap) => FiltrosBitacora;
  readonly escribir: (filtros: FiltrosBitacora) => Params;
  /** El registro de la historia: se conserva al filtrar y al limpiar (`crearListado`, `fijos`). */
  readonly fijos: (parametros: ParamMap) => Params;
}

/** `?entidad=usuario&entidadId=<id>`: la historia de ese registro. Otra cosa, toda la bitácora. */
export function registroDeUrl(parametros: ParamMap): RegistroBitacora | null {
  const entidad = textoDeUrl(parametros, 'entidad');
  const entidadId = textoDeUrl(parametros, 'entidadId');
  return tieneHistoria(entidad) && ID.test(entidadId) ? { entidad, entidadId } : null;
}

/**
 * `?desde=2026-10-01&hasta=2026-10-31&usuario=<id>&accion=auth.usuario`. Sin fechas (o con una que
 * no es un día), los últimos 7 días hasta `hoy`: así `/bitacora` siempre abre con lo reciente.
 * Una acción que la pantalla no conoce se ignora. Que el rango no pase de 92 días lo dice el
 * backend (regla 8).
 *
 * Con `?entidad=usuario&entidadId=<id>`, la historia de ese registro: sin fechas, toda (6.12c0b).
 */
export function filtrosBitacoraUrl(hoy: string): FiltrosBitacoraUrl {
  return {
    leer(parametros) {
      const iniciales = filtrosBitacoraIniciales(hoy, registroDeUrl(parametros));
      const desde = textoDeUrl(parametros, 'desde');
      const hasta = textoDeUrl(parametros, 'hasta');
      const usuario = textoDeUrl(parametros, 'usuario');
      const accion = textoDeUrl(parametros, 'accion');
      return {
        desde: esDia(desde) ? desde : iniciales.desde,
        hasta: esDia(hasta) ? hasta : iniciales.hasta,
        usuario: ID.test(usuario) ? usuario : iniciales.usuario,
        accion: esFiltroDeAccion(accion) ? accion : iniciales.accion,
        registro: iniciales.registro,
      };
    },
    escribir(filtros) {
      const iniciales = filtrosBitacoraIniciales(hoy, filtros.registro);
      return {
        ...filtroAUrl('desde', filtros.desde, iniciales.desde),
        ...filtroAUrl('hasta', filtros.hasta, iniciales.hasta),
        ...filtroAUrl('usuario', filtros.usuario, iniciales.usuario),
        ...filtroAUrl('accion', filtros.accion, iniciales.accion),
      };
    },
    fijos(parametros) {
      const registro = registroDeUrl(parametros);
      return registro === null ? {} : { ...registro };
    },
  };
}
