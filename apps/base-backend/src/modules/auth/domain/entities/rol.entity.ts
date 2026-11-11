import { RolAdministradorFijoError } from '../errors/auth.errors.js';
import { descripcionRol, NombreRol } from '../value-objects/nombre-rol.vo.js';

/** Lo que se guarda de un rol (`seguridad.roles`). */
export interface DatosRol {
  readonly id: string;
  readonly empresaId: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly esAdministrador: boolean;
  readonly activo: boolean;
}

/**
 * Un rol de una empresa. Maestro: se desactiva, nunca se borra (un rol desactivado no da
 * permisos; sus asignaciones quedan por si se reactiva). El Administrador es uno por empresa,
 * tiene todos los permisos de **esa** empresa y no se edita ni se desactiva (AUTH-D10).
 * Inmutable: cada cambio devuelve otro `Rol`.
 */
export class Rol {
  readonly id: string;
  readonly empresaId: string;
  readonly nombre: NombreRol;
  readonly descripcion: string | null;
  readonly esAdministrador: boolean;
  readonly activo: boolean;

  private constructor(datos: DatosRol) {
    this.id = datos.id;
    this.empresaId = datos.empresaId;
    this.nombre = NombreRol.crear(datos.nombre);
    this.descripcion = descripcionRol(datos.descripcion);
    this.esAdministrador = datos.esAdministrador;
    this.activo = datos.activo;
  }

  /** Desde lo guardado (el repositorio). */
  static reconstruir(datos: DatosRol): Rol {
    return new Rol(datos);
  }

  datos(): DatosRol {
    return {
      id: this.id,
      empresaId: this.empresaId,
      nombre: this.nombre.valor,
      descripcion: this.descripcion,
      esAdministrador: this.esAdministrador,
      activo: this.activo,
    };
  }

  /** `RolAdministradorFijoError` si es el Administrador. */
  desactivar(): Rol {
    this.revisarQueNoSeaAdministrador();
    return new Rol({ ...this.datos(), activo: false });
  }

  reactivar(): Rol {
    return new Rol({ ...this.datos(), activo: true });
  }

  /** Nombre y descripción nuevos. `RolAdministradorFijoError` si es el Administrador. */
  editar(nombre: NombreRol, descripcion: string | null): Rol {
    this.revisarQueNoSeaAdministrador();
    return new Rol({ ...this.datos(), nombre: nombre.valor, descripcion });
  }

  private revisarQueNoSeaAdministrador(): void {
    if (this.esAdministrador) {
      throw new RolAdministradorFijoError();
    }
  }
}
