import type { Sesion, TokenAcceso } from '../../domain/sesion';

/** Una sesión completa para las pruebas; se cambia solo lo que importa en cada una. */
export function sesionDePrueba(cambios: Partial<Sesion> = {}): Sesion {
  return {
    usuario: {
      id: 'u-1',
      nombreUsuario: 'ana.perez',
      nombreCompleto: 'Ana Pérez',
      debeCambiarContrasena: false,
    },
    empresaActiva: { id: 'e-1', nombre: 'Empresa Uno' },
    empresas: [{ id: 'e-1', nombre: 'Empresa Uno' }],
    esAdministrador: false,
    permisos: [],
    zonaNegocio: 'America/Guayaquil',
    sesionVenceEn: '2026-07-15T18:00:00.000Z',
    ...cambios,
  };
}

export function tokenDePrueba(valor = 'token-1'): TokenAcceso {
  return { valor, expiraEnSegundos: 900 };
}
