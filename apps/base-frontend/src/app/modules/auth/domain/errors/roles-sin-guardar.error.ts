import type { Usuario } from '../usuario';

/**
 * Al guardar la ficha se guardó el nombre, pero los roles no (son dos peticiones:
 * `PATCH /usuarios/:id` y `PUT /usuarios/:id/roles`). Trae el usuario como quedó y el error de
 * los roles, para mostrar el nombre ya guardado y dejar los roles pendientes.
 */
export class RolesSinGuardarError extends Error {
  constructor(
    readonly usuario: Usuario,
    readonly causa: unknown,
  ) {
    super(causa instanceof Error ? causa.message : 'No se pudieron guardar los roles');
    this.name = 'RolesSinGuardarError';
  }
}
