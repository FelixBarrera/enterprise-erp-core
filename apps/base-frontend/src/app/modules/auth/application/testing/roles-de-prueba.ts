import type { GrupoPermisos } from '../../domain/permisos-rol';
import type { Rol, RolResumen } from '../../domain/rol';

/** Un rol para las pruebas, con lo que se quiera cambiar. */
export function rolDePrueba(cambios: Partial<Rol> = {}): Rol {
  return {
    id: 'r-1',
    nombre: 'Jefe de oficina',
    descripcion: 'Crea usuarios y les da roles',
    esAdministrador: false,
    activo: true,
    cantidadUsuarios: 2,
    permisos: ['auth.usuario.ver'],
    creado: { en: '2026-11-02T15:15:00.000Z', por: 'ana.perez' },
    modificado: null,
    ...cambios,
  };
}

/** Una fila de la lista para las pruebas. */
export function rolResumenDePrueba(cambios: Partial<RolResumen> = {}): RolResumen {
  return {
    id: 'r-1',
    nombre: 'Jefe de oficina',
    descripcion: 'Crea usuarios y les da roles',
    esAdministrador: false,
    activo: true,
    cantidadUsuarios: 2,
    cantidadPermisos: 7,
    ...cambios,
  };
}

/** Un catálogo corto para las pruebas: dos grupos (3 y 1 permisos). */
export function catalogoDePrueba(): GrupoPermisos[] {
  return [
    {
      modulo: 'auth',
      nombre: 'Usuarios y roles',
      permisos: [
        { codigo: 'auth.usuario.ver', descripcion: 'Ver usuarios' },
        { codigo: 'auth.usuario.restablecer', descripcion: 'Dar contraseña temporal' },
        { codigo: 'auth.rol.ver', descripcion: 'Ver roles' },
      ],
    },
    {
      modulo: 'empresas',
      nombre: 'Empresa',
      permisos: [{ codigo: 'empresas.empresa.editar', descripcion: 'Editar la empresa' }],
    },
  ];
}
