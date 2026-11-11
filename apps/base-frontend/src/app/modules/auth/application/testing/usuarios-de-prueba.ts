import type { RolAsignable, Usuario, UsuarioResumen } from '../../domain/usuario';

/** Un usuario para las pruebas (con un rol, sin sesiones), con lo que se quiera cambiar. */
export function usuarioDePrueba(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    nombreUsuario: 'jorge.vera',
    nombreCompleto: 'Jorge Vera',
    activo: true,
    bloqueadoHasta: null,
    ultimoIngresoEn: '2026-11-03T16:28:00.000Z',
    roles: [{ id: 'r-soporte', nombre: 'Soporte', esAdministrador: false, activo: true }],
    debeCambiarContrasena: false,
    trabajaEnOtrasEmpresas: false,
    sesiones: [],
    creado: { en: '2026-10-12T14:00:00.000Z', por: 'ana.perez' },
    modificado: null,
    ...cambios,
  };
}

/** Una fila de la lista para las pruebas. */
export function usuarioResumenDePrueba(cambios: Partial<UsuarioResumen> = {}): UsuarioResumen {
  const u = usuarioDePrueba();
  return {
    id: u.id,
    nombreUsuario: u.nombreUsuario,
    nombreCompleto: u.nombreCompleto,
    activo: u.activo,
    bloqueadoHasta: u.bloqueadoHasta,
    ultimoIngresoEn: u.ultimoIngresoEn,
    roles: u.roles,
    debeCambiarContrasena: u.debeCambiarContrasena,
    ...cambios,
  };
}

/** Los roles activos de la empresa: el Administrador, uno que se puede dar y uno que no. */
export function rolesAsignablesDePrueba(): RolAsignable[] {
  return [
    {
      id: 'r-admin',
      nombre: 'Administrador',
      descripcion: 'Tiene todos los permisos',
      esAdministrador: true,
      sePuedeDar: false,
    },
    {
      id: 'r-consulta',
      nombre: 'Consulta',
      descripcion: 'Solo mira',
      esAdministrador: false,
      sePuedeDar: true,
    },
    {
      id: 'r-cumplimiento',
      nombre: 'Cumplimiento',
      descripcion: null,
      esAdministrador: false,
      sePuedeDar: false,
    },
    {
      id: 'r-soporte',
      nombre: 'Soporte',
      descripcion: 'Desbloquea cuentas',
      esAdministrador: false,
      sePuedeDar: true,
    },
  ];
}
