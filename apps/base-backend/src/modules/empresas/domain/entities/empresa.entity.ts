import { NombreEmpresa } from '../value-objects/nombre-empresa.vo.js';

/**
 * Una empresa de la instalación (EMP-D1). Maestro: se desactiva, nunca se borra (EMP-D9).
 * Inmutable: cada cambio devuelve otra `Empresa`.
 */
export class Empresa {
  private constructor(
    readonly id: string,
    readonly nombre: NombreEmpresa,
    readonly activo: boolean,
  ) {}

  /** Desde lo guardado (el repositorio). */
  static reconstruir(datos: { id: string; nombre: string; activo: boolean }): Empresa {
    return new Empresa(datos.id, NombreEmpresa.crear(datos.nombre), datos.activo);
  }

  /** La misma empresa, con otro nombre. */
  renombrar(nombre: NombreEmpresa): Empresa {
    return new Empresa(this.id, nombre, this.activo);
  }

  /** La misma empresa, desactivada. Sus datos quedan; nadie puede entrar en ella. */
  desactivar(): Empresa {
    return new Empresa(this.id, this.nombre, false);
  }
}
