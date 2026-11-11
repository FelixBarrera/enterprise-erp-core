import { EventoAuditoriaInvalidoError } from './errors/auditoria.errors.js';

/** Un valor tal como queda en la columna `jsonb`. */
export type ValorJson =
  string | number | boolean | null | ValorJson[] | { [campo: string]: ValorJson };

/** `antes` o `despues`: solo los campos que cambiaron. */
export type CambiosJson = { [campo: string]: ValorJson };

/** `modulo.recurso.accion`, en minúsculas (el mismo `CHECK` está en la base). */
export const FORMATO_ACCION = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/**
 * Campos que nunca entran a la bitácora con su valor (AUD-D4), por el nombre, en cualquier nivel.
 * "clave" no está a propósito: la clave de acceso del SRI no es secreta.
 */
export const CAMPO_SENSIBLE = /contrasena|password|hash|token|secreto|secret/i;

/** Lo que se guarda en lugar de un valor sensible que cambió: se sabe que cambió, no a qué. */
export const VALOR_OCULTO = '[OCULTO]';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Límites de las columnas: lo que viene de afuera (navegador) se recorta, no rompe el cambio. */
const LARGO = {
  accion: 100,
  entidad: 60,
  entidadNombre: 150,
  nombreUsuario: 50,
  ip: 45,
  navegador: 300,
  requestId: 64,
};

/** Lo que manda el módulo que registra. */
export interface DatosEvento {
  accion: string;
  entidad?: string;
  entidadId?: string;
  /**
   * Cómo se llamaba el registro en ese momento (el nombre de usuario, el del rol, el de la
   * empresa; de una sesión, su usuario), para «Sobre qué» de la lista (6.12c0b). Solo con
   * `entidad`. Lo que pase de 150 caracteres se recorta.
   */
  entidadNombre?: string | null;
  antes?: Record<string, unknown>;
  despues?: Record<string, unknown>;
}

/** Quién y desde dónde (la misma forma que el `Actor` de `shared/application`). */
export interface Autor {
  usuarioId: string | null;
  nombreUsuario: string | null;
  empresaId: string | null;
  ip: string | null;
  navegador: string | null;
  requestId: string | null;
}

/** Un evento listo para guardar. */
export interface EventoAuditoria {
  ocurridoEn: Date;
  empresaId: string | null;
  usuarioId: string | null;
  nombreUsuario: string | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  entidadNombre: string | null;
  antes: CambiosJson | null;
  despues: CambiosJson | null;
  ip: string | null;
  navegador: string | null;
  requestId: string | null;
}

/**
 * Arma el evento: valida la acción y la entidad, deja en `antes`/`despues` solo lo que cambió y
 * oculta lo sensible. Devuelve `null` si se mandaron `antes` y `despues` y nada cambió (AUD-D3).
 *
 * - Solo `despues` (se creó algo): todos sus campos. Solo `antes`: todos los de antes.
 * - Ni `antes` ni `despues` (un login, un intento fallido): el evento va sin cambios.
 */
export function armarEventoAuditoria(
  datos: DatosEvento,
  autor: Autor,
  ocurridoEn: Date,
): EventoAuditoria | null {
  validar(datos);
  const antes = datos.antes === undefined ? null : aObjetoJson(datos.antes);
  const despues = datos.despues === undefined ? null : aObjetoJson(datos.despues);

  let cambios: { antes: CambiosJson | null; despues: CambiosJson | null };
  if (antes !== null && despues !== null) {
    cambios = soloLoQueCambio(antes, despues);
    if (Object.keys(cambios.despues ?? {}).length === 0) {
      return null;
    }
  } else {
    cambios = {
      antes: antes === null ? null : ocultarSensibles(antes),
      despues: despues === null ? null : ocultarSensibles(despues),
    };
  }

  return {
    ocurridoEn,
    empresaId: autor.empresaId,
    usuarioId: autor.usuarioId,
    nombreUsuario: texto(autor.nombreUsuario, LARGO.nombreUsuario),
    accion: datos.accion,
    entidad: datos.entidad ?? null,
    entidadId: datos.entidadId ?? null,
    entidadNombre: texto(datos.entidadNombre ?? null, LARGO.entidadNombre),
    antes: cambios.antes,
    despues: cambios.despues,
    ip: texto(autor.ip, LARGO.ip),
    navegador: texto(autor.navegador, LARGO.navegador),
    requestId: texto(autor.requestId, LARGO.requestId),
  };
}

function validar(datos: DatosEvento): void {
  if (datos.accion.length > LARGO.accion || !FORMATO_ACCION.test(datos.accion)) {
    throw new EventoAuditoriaInvalidoError(
      `la acción "${datos.accion}" no tiene la forma modulo.recurso.accion`,
    );
  }
  if ((datos.entidad === undefined) !== (datos.entidadId === undefined)) {
    throw new EventoAuditoriaInvalidoError('la entidad y su id van juntos (o ninguno)');
  }
  if (
    datos.entidad !== undefined &&
    (datos.entidad.trim() === '' || datos.entidad.length > LARGO.entidad)
  ) {
    throw new EventoAuditoriaInvalidoError(`la entidad "${datos.entidad}" no es válida`);
  }
  if (
    datos.entidadNombre !== undefined &&
    datos.entidadNombre !== null &&
    datos.entidad === undefined
  ) {
    throw new EventoAuditoriaInvalidoError('el nombre del registro va solo con su entidad');
  }
  if (datos.entidadId !== undefined && !UUID.test(datos.entidadId)) {
    throw new EventoAuditoriaInvalidoError(`el id "${datos.entidadId}" no es un UUID`);
  }
}

/** Como quedará en la base: fechas, `Dinero` y `FechaFiscal` pasan por su `toJSON()`. */
function aObjetoJson(objeto: Record<string, unknown>): CambiosJson {
  const texto = JSON.stringify(objeto, (_campo, valor: unknown) =>
    typeof valor === 'bigint' ? valor.toString() : valor,
  );
  return JSON.parse(texto) as CambiosJson;
}

function soloLoQueCambio(
  antes: CambiosJson,
  despues: CambiosJson,
): { antes: CambiosJson; despues: CambiosJson } {
  const resultado = { antes: {} as CambiosJson, despues: {} as CambiosJson };
  const campos = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  for (const campo of campos) {
    const valorAntes = antes[campo] ?? null;
    const valorDespues = despues[campo] ?? null;
    if (textoEstable(valorAntes) === textoEstable(valorDespues)) {
      continue;
    }
    const sensible = CAMPO_SENSIBLE.test(campo);
    resultado.antes[campo] = sensible ? VALOR_OCULTO : ocultarEnValor(valorAntes);
    resultado.despues[campo] = sensible ? VALOR_OCULTO : ocultarEnValor(valorDespues);
  }
  return resultado;
}

function ocultarSensibles(objeto: CambiosJson): CambiosJson {
  const resultado: CambiosJson = {};
  for (const [campo, valor] of Object.entries(objeto)) {
    resultado[campo] = CAMPO_SENSIBLE.test(campo) ? VALOR_OCULTO : ocultarEnValor(valor);
  }
  return resultado;
}

/** También dentro de objetos y listas (una dirección, una lista de contactos). */
function ocultarEnValor(valor: ValorJson): ValorJson {
  if (Array.isArray(valor)) {
    return valor.map(ocultarEnValor);
  }
  if (valor !== null && typeof valor === 'object') {
    return ocultarSensibles(valor);
  }
  return valor;
}

/** Texto con las claves ordenadas: `{a, b}` y `{b, a}` son el mismo valor. */
function textoEstable(valor: ValorJson): string {
  if (Array.isArray(valor)) {
    return `[${valor.map(textoEstable).join(',')}]`;
  }
  if (valor !== null && typeof valor === 'object') {
    const campos = Object.keys(valor).sort();
    return `{${campos.map((c) => `${JSON.stringify(c)}:${textoEstable(valor[c] ?? null)}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

function texto(valor: string | null, largo: number): string | null {
  if (valor === null) {
    return null;
  }
  const limpio = valor.trim();
  return limpio === '' ? null : limpio.slice(0, largo);
}
