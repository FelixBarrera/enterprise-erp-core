import type { CambiosEvento, ValorJson } from './evento';

/**
 * «Qué cambió» en el detalle de un evento: una fila por dato, con cómo estaba y cómo quedó, en
 * palabras de la pantalla. La API manda los nombres de los campos (`nombreCompleto`) y los valores
 * crudos (`true`, `REUSO`); aquí se traducen. Un campo nuevo del backend se suma a `CAMPOS`;
 * `cambios.spec.ts` tiene la lista de los que registra hoy y falla si falta uno. Uno que la
 * pantalla no conoce sale con su nombre tal cual.
 */

/** Lo que guarda el backend en lugar de un valor sensible (AUD-D4). */
export const VALOR_OCULTO = '[OCULTO]';

/** Un elemento de una lista (roles, permisos): lo que se agregó o se quitó va marcado. */
export interface ElementoLista {
  readonly texto: string;
  readonly cambio: 'agrega' | 'quita' | null;
}

/** Un lado de la fila, listo para la plantilla. */
export type ValorMostrado =
  /** `tenue`: «Sin dato», «Oculto», «Ninguno» (en gris). */
  | { readonly tipo: 'texto'; readonly texto: string; readonly tenue: boolean }
  /** Un instante (ISO): la pantalla lo muestra en la zona del negocio. */
  | { readonly tipo: 'instante'; readonly iso: string }
  | { readonly tipo: 'lista'; readonly elementos: readonly ElementoLista[] };

export interface FilaCambio {
  /** El nombre del campo en la API (`nombreCompleto`), para el `track`. */
  readonly campo: string;
  /** «Nombre completo». */
  readonly dato: string;
  readonly antes: ValorMostrado;
  readonly despues: ValorMostrado;
}

export interface OpcionesCambios {
  /** «Ver usuarios» de `auth.usuario.ver`; sin el catálogo, el código. */
  readonly textoPermiso?: (codigo: string) => string;
}

type Formato = 'texto' | 'instante' | 'permisos' | 'motivoCierre' | 'motivoFallido';

interface Campo {
  readonly dato: string;
  readonly formato?: Formato;
}

/** Los campos que registra el backend, en el orden en que se muestran. */
const CAMPOS: Readonly<Record<string, Campo>> = {
  nombreUsuario: { dato: 'Nombre de usuario' },
  nombreCompleto: { dato: 'Nombre completo' },
  nombre: { dato: 'Nombre' },
  descripcion: { dato: 'Descripción' },
  esAdministrador: { dato: 'Es el rol Administrador' },
  activo: { dato: 'Activo' },
  roles: { dato: 'Roles' },
  permisos: { dato: 'Permisos', formato: 'permisos' },
  claveTemporal: { dato: 'Contraseña temporal' },
  debeCambiarContrasena: { dato: 'Debe cambiar su contraseña' },
  bloqueadoHasta: { dato: 'Bloqueado hasta', formato: 'instante' },
  intentosFallidos: { dato: 'Intentos fallidos' },
  motivo: { dato: 'Motivo', formato: 'motivoFallido' },
  empresa: { dato: 'Empresa' },
  empresaId: { dato: 'Empresa (código interno)' },
  venceEn: { dato: 'La sesión vence', formato: 'instante' },
  motivoCierre: { dato: 'Por qué se cerró', formato: 'motivoCierre' },
  sesionesCerradas: { dato: 'Sesiones cerradas' },
};

/** Los nombres de los campos que la pantalla sabe mostrar (para la prueba). */
export const CAMPOS_CONOCIDOS: readonly string[] = Object.keys(CAMPOS);

/** Por qué se cerró una sesión (`MotivoCierreSesion` del backend). */
const MOTIVOS_CIERRE: Readonly<Record<string, string>> = {
  SALIDA: 'Salió del sistema',
  CAMBIO_CONTRASENA: 'Cambió su contraseña',
  REUSO: 'Se usó una sesión ya renovada (posible robo)',
  ADMINISTRADOR: 'La cerró un administrador',
  USUARIO_DESACTIVADO: 'Se desactivó el usuario',
  EMPRESA_DESACTIVADA: 'Se desactivó la empresa',
  ACCESO_QUITADO: 'Se le quitó el acceso',
};

/** Por qué falló un ingreso (`MotivoLoginFallido` del backend). */
const MOTIVOS_FALLIDO: Readonly<Record<string, string>> = {
  NO_EXISTE: 'El usuario no existe',
  CONTRASENA_INCORRECTA: 'Contraseña incorrecta',
  BLOQUEADO: 'Estaba bloqueado',
  DESACTIVADO: 'Estaba desactivado',
  SIN_EMPRESA: 'Sin acceso a ninguna empresa',
};

/** Los códigos de motivo que la pantalla traduce (para la prueba). */
export const MOTIVOS_CONOCIDOS = {
  cierre: Object.keys(MOTIVOS_CIERRE),
  fallido: Object.keys(MOTIVOS_FALLIDO),
} as const;

const tenue = (texto: string): ValorMostrado => ({ tipo: 'texto', texto, tenue: true });
const normal = (texto: string): ValorMostrado => ({ tipo: 'texto', texto, tenue: false });

const SIN_DATO = tenue('Sin dato');

function aTexto(valor: ValorJson): string {
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
}

/**
 * Las filas de «Qué cambió». Solo vienen los campos que cambiaron (AUD-D3); al crear algo solo
 * hay `despues`, y lo que falta de un lado sale «Sin dato». En las listas, lo que se agregó y lo
 * que se quitó van marcados (si hay los dos lados). Sin cambios (un ingreso), ninguna fila.
 */
export function filasDeCambios(
  antes: CambiosEvento | null,
  despues: CambiosEvento | null,
  opciones: OpcionesCambios = {},
): FilaCambio[] {
  const campos = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])];
  const orden = (campo: string): number => {
    const i = CAMPOS_CONOCIDOS.indexOf(campo);
    return i === -1 ? CAMPOS_CONOCIDOS.length : i;
  };
  // `sort` es estable: los que la pantalla no conoce quedan al final, en el orden en que llegaron.
  campos.sort((a, b) => orden(a) - orden(b));

  return campos.map((campo) => {
    const conocido = CAMPOS[campo] as Campo | undefined;
    const formato = conocido?.formato ?? 'texto';
    const deAntes = antes?.[campo];
    const deDespues = despues?.[campo];
    const mostrar = (
      valor: ValorJson | undefined,
      otro: ValorJson | undefined,
      cambio: 'agrega' | 'quita',
    ) => valorMostrado(valor, otro, cambio, formato, opciones);
    return {
      campo,
      dato: conocido?.dato ?? campo,
      antes: mostrar(deAntes, deDespues, 'quita'),
      despues: mostrar(deDespues, deAntes, 'agrega'),
    };
  });
}

function valorMostrado(
  valor: ValorJson | undefined,
  otro: ValorJson | undefined,
  cambio: 'agrega' | 'quita',
  formato: Formato,
  opciones: OpcionesCambios,
): ValorMostrado {
  if (valor === undefined || valor === null) return SIN_DATO;
  if (valor === VALOR_OCULTO) return tenue('Oculto');
  if (typeof valor === 'boolean') return normal(valor ? 'Sí' : 'No');
  if (typeof valor === 'number') return normal(String(valor));
  if (Array.isArray(valor)) {
    if (valor.length === 0) return tenue('Ninguno');
    const { textoPermiso } = opciones;
    const textoElemento = (v: ValorJson): string =>
      formato === 'permisos' && textoPermiso !== undefined && typeof v === 'string'
        ? textoPermiso(v)
        : aTexto(v);
    const delOtro = Array.isArray(otro) ? new Set(otro.map(aTexto)) : null;
    return {
      tipo: 'lista',
      elementos: valor.map((v) => ({
        texto: textoElemento(v),
        cambio: delOtro !== null && !delOtro.has(aTexto(v)) ? cambio : null,
      })),
    };
  }
  if (typeof valor !== 'string') return normal(aTexto(valor));
  if (valor === '') return tenue('Vacío');
  if (formato === 'instante') return { tipo: 'instante', iso: valor };
  if (formato === 'motivoCierre') return normal(MOTIVOS_CIERRE[valor] ?? valor);
  if (formato === 'motivoFallido') return normal(MOTIVOS_FALLIDO[valor] ?? valor);
  return normal(valor);
}
