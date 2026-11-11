import { FORMATO_ACCION, type DatosEvento } from './evento-auditoria.js';

/**
 * Lo que registra un módulo en la bitácora (su `<modulo>.auditoria.ts`, juntos en
 * `src/catalogo-auditoria.ts`). No cambia lo que se guarda: es la lista que copia el frontend
 * para mostrar cada acción, campo y valor en español (AUD-D9), y la que revisan las pruebas.
 */
export interface DeclaracionAuditoria {
  modulo: string;
  /** Las acciones `modulo.recurso.accion` que registra (todas de este módulo). */
  acciones: readonly string[];
  /** Los campos que guarda en `antes`/`despues` (el primer nivel, en camelCase). */
  campos: readonly string[];
  /** Los campos con valores fijos (un motivo): la pantalla traduce cada valor. */
  valores?: Readonly<Record<string, readonly string[]>>;
}

/** Lo que está mal escrito en el catálogo (vacío si está bien). */
export function erroresDelCatalogoAuditoria(catalogo: readonly DeclaracionAuditoria[]): string[] {
  const errores: string[] = [];
  const modulos = new Set<string>();
  const acciones = new Set<string>();
  for (const { modulo, acciones: suyas, campos, valores = {} } of catalogo) {
    if (modulos.has(modulo)) {
      errores.push(`el módulo "${modulo}" está dos veces`);
    }
    modulos.add(modulo);
    for (const accion of suyas) {
      if (!FORMATO_ACCION.test(accion)) {
        errores.push(`la acción "${accion}" no tiene la forma modulo.recurso.accion`);
      } else if (!accion.startsWith(`${modulo}.`)) {
        errores.push(`la acción "${accion}" no es del módulo "${modulo}"`);
      }
      if (acciones.has(accion)) {
        errores.push(`la acción "${accion}" está dos veces`);
      }
      acciones.add(accion);
    }
    if (new Set(campos).size !== campos.length) {
      errores.push(`el módulo "${modulo}" repite un campo`);
    }
    for (const campo of Object.keys(valores)) {
      if (!campos.includes(campo)) {
        errores.push(`"${campo}" tiene valores pero no está en los campos de "${modulo}"`);
      }
    }
  }
  return errores;
}

/**
 * Lo que trae un evento y no está en el catálogo del módulo de su acción: la acción, un campo de
 * `antes`/`despues` o un valor fijo (vacío si todo está). Lo usa `AuditoriaEnMemoria`.
 */
export function faltasEnCatalogoAuditoria(
  datos: DatosEvento,
  catalogo: readonly DeclaracionAuditoria[],
): string[] {
  const modulo = datos.accion.split('.')[0];
  const declaracion = catalogo.find((d) => d.modulo === modulo);
  if (declaracion === undefined || !declaracion.acciones.includes(datos.accion)) {
    return [`la acción "${datos.accion}"`];
  }
  const faltas: string[] = [];
  for (const lado of [datos.antes, datos.despues]) {
    for (const [campo, valor] of Object.entries(lado ?? {})) {
      const fijos = declaracion.valores?.[campo];
      if (!declaracion.campos.includes(campo)) {
        faltas.push(`el campo "${campo}" (en ${datos.accion})`);
      } else if (fijos !== undefined && typeof valor === 'string' && !fijos.includes(valor)) {
        faltas.push(`el valor "${valor}" de "${campo}" (en ${datos.accion})`);
      }
    }
  }
  return [...new Set(faltas)];
}
