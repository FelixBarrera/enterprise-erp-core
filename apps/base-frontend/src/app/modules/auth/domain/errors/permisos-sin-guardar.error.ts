import type { Rol } from '../rol';

/**
 * Al guardar la ficha se guardaron el nombre y la descripción, pero los permisos no (son dos
 * peticiones: `PATCH /roles/:id` y `PUT /roles/:id/permisos`). Trae el rol como quedó y el error
 * de los permisos, para mostrar los datos ya guardados y dejar los permisos pendientes.
 */
export class PermisosSinGuardarError extends Error {
  constructor(
    readonly rol: Rol,
    readonly causa: unknown,
  ) {
    super(causa instanceof Error ? causa.message : 'No se pudieron guardar los permisos');
    this.name = 'PermisosSinGuardarError';
  }
}
