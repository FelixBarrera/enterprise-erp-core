import { CodigoPermiso } from '../value-objects/codigo-permiso.vo.js';
import { textoLimpio } from '../value-objects/texto-limpio.js';

export const LARGO_MAXIMO_DESCRIPCION_PERMISO = 150;
export const LARGO_MAXIMO_NOMBRE_MODULO = 60;

/** Lo que declara un módulo: su nombre para la pantalla y sus permisos (código → descripción). */
export interface DeclaracionDeModulo {
  readonly modulo: string;
  /** El título del grupo al armar un rol («Usuarios y roles»). */
  readonly nombre: string;
  readonly permisos: Readonly<Record<string, string>>;
}

/** Los permisos de un módulo, juntos, en el orden en que los declara. */
export interface GrupoDePermisos {
  readonly modulo: string;
  readonly nombre: string;
  readonly permisos: readonly PermisoDeclarado[];
}

/** Un permiso tal como lo declara el código, ya revisado. */
export interface PermisoDeclarado {
  readonly codigo: string;
  readonly descripcion: string;
}

/** Un permiso tal como está en `seguridad.permisos`. */
export interface PermisoGuardado {
  readonly id: string;
  readonly codigo: string;
  readonly descripcion: string;
  readonly obsoleto: boolean;
}

/** Qué hay que escribir para que la base quede igual al código. Nunca se borra nada. */
export interface PlanSincronizacion {
  /** Declarados que la base no tiene. */
  readonly nuevos: readonly PermisoDeclarado[];
  /** Ya guardados con otra descripción o que estaban obsoletos y volvieron: quedan vigentes. */
  readonly cambiados: readonly PermisoGuardado[];
  /** Vigentes en la base que el código ya no declara: pasan a obsoletos. */
  readonly obsoletos: readonly PermisoGuardado[];
}

/**
 * Error de programación en un `<modulo>.permisos.ts`: la API no arranca (no es un error del
 * negocio, nunca llega a una respuesta).
 */
export class CatalogoPermisosInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Catálogo de permisos inválido: ${motivo}`);
    this.name = 'CatalogoPermisosInvalidoError';
  }
}

/**
 * Los permisos que declara el código, revisados: formato `modulo.recurso.accion`, cada uno del
 * módulo que lo declara, con descripción de 1 a 150 caracteres; cada módulo una sola vez y con su
 * nombre (así ningún código se repite: empieza por el módulo, y un objeto no repite claves).
 */
export class CatalogoPermisos {
  private constructor(
    private readonly porCodigo: ReadonlyMap<string, PermisoDeclarado>,
    private readonly losGrupos: readonly GrupoDePermisos[],
  ) {}

  static desde(declaraciones: readonly DeclaracionDeModulo[]): CatalogoPermisos {
    const porCodigo = new Map<string, PermisoDeclarado>();
    const grupos: GrupoDePermisos[] = [];
    for (const { modulo, nombre: nombreEscrito, permisos } of declaraciones) {
      if (grupos.some((g) => g.modulo === modulo)) {
        throw new CatalogoPermisosInvalidoError(`el módulo «${modulo}» está declarado dos veces`);
      }
      const nombre = textoLimpio(nombreEscrito);
      if (nombre.length === 0 || nombre.length > LARGO_MAXIMO_NOMBRE_MODULO) {
        throw new CatalogoPermisosInvalidoError(
          `el nombre del módulo «${modulo}» tiene que tener de 1 a ${LARGO_MAXIMO_NOMBRE_MODULO} caracteres`,
        );
      }
      const delModulo: PermisoDeclarado[] = [];
      for (const [texto, descripcionEscrita] of Object.entries(permisos)) {
        const codigo = codigoValido(texto);
        if (codigo.modulo !== modulo) {
          throw new CatalogoPermisosInvalidoError(
            `«${texto}» lo declara el módulo «${modulo}»: tiene que empezar por «${modulo}.»`,
          );
        }
        const descripcion = textoLimpio(descripcionEscrita);
        if (descripcion.length === 0 || descripcion.length > LARGO_MAXIMO_DESCRIPCION_PERMISO) {
          throw new CatalogoPermisosInvalidoError(
            `la descripción de «${texto}» tiene que tener de 1 a ${LARGO_MAXIMO_DESCRIPCION_PERMISO} caracteres`,
          );
        }
        const permiso = { codigo: codigo.valor, descripcion };
        porCodigo.set(codigo.valor, permiso);
        delModulo.push(permiso);
      }
      grupos.push({ modulo, nombre, permisos: delModulo });
    }
    return new CatalogoPermisos(porCodigo, grupos);
  }

  /**
   * Por módulo, para armar un rol: los módulos y sus permisos en el orden en que se declaran
   * (`src/catalogo-permisos.ts` y cada `<modulo>.permisos.ts`), que es el que se pensó para la
   * pantalla. Un módulo sin permisos no sale.
   */
  get grupos(): GrupoDePermisos[] {
    return this.losGrupos.filter((g) => g.permisos.length > 0);
  }

  /** Los declarados, por código. */
  get permisos(): PermisoDeclarado[] {
    return [...this.porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  incluye(codigo: string): boolean {
    return this.porCodigo.has(codigo);
  }

  /** Compara con lo guardado y dice qué escribir (crea, actualiza, marca obsoleto; nunca borra). */
  planContra(guardados: readonly PermisoGuardado[]): PlanSincronizacion {
    const guardadosPorCodigo = new Map(guardados.map((p) => [p.codigo, p]));
    const nuevos: PermisoDeclarado[] = [];
    const cambiados: PermisoGuardado[] = [];
    for (const declarado of this.permisos) {
      const guardado = guardadosPorCodigo.get(declarado.codigo);
      if (guardado === undefined) {
        nuevos.push(declarado);
      } else if (guardado.obsoleto || guardado.descripcion !== declarado.descripcion) {
        cambiados.push({ ...guardado, descripcion: declarado.descripcion, obsoleto: false });
      }
    }
    const obsoletos = guardados
      .filter((p) => !p.obsoleto && !this.porCodigo.has(p.codigo))
      .map((p) => ({ ...p, obsoleto: true }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
    return { nuevos, cambiados, obsoletos };
  }
}

function codigoValido(texto: string): CodigoPermiso {
  try {
    return CodigoPermiso.crear(texto);
  } catch {
    throw new CatalogoPermisosInvalidoError(
      `«${texto}» no tiene el formato modulo.recurso.accion (minúsculas, números y _)`,
    );
  }
}
