import type { EventoDetalle, EventoResumen } from '../../domain/evento';

/** Una fila de la bitácora para las pruebas: «ana.perez cambió los roles de jorge.vera». */
export function eventoDePrueba(cambios: Partial<EventoResumen> = {}): EventoResumen {
  return {
    id: '0190a4f2-1c2b-7000-8000-000000000901',
    ocurridoEn: '2026-11-07T15:42:00.000Z',
    usuarioId: '0190a4f2-1c2b-7000-8000-000000000101',
    nombreUsuario: 'ana.perez',
    accion: 'auth.usuario.asignar_roles',
    entidad: 'usuario',
    entidadId: '0190a4f2-1c2b-7000-8000-000000000102',
    entidadNombre: 'jorge.vera',
    ...cambios,
  };
}

/** El detalle de `eventoDePrueba()`: se cambiaron los roles de jorge.vera. */
export function detalleDePrueba(cambios: Partial<EventoDetalle> = {}): EventoDetalle {
  return {
    ...eventoDePrueba(),
    antes: { roles: ['Soporte', 'Operaciones'] },
    despues: { roles: ['Soporte', 'Cumplimiento'] },
    ip: '10.0.0.7',
    navegador: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/142.0',
    requestId: '5f2c9a1e-7d43-4b8a-9c11-0e6b2f8d4a70',
    ...cambios,
  };
}
