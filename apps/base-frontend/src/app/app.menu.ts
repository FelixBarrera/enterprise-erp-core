import type { SeccionMenu } from './shared/infrastructure/layout/menu';

// Opciones del menú lateral, por secciones. Cada módulo nuevo agrega aquí las suyas.
export const MENU: readonly SeccionMenu[] = [
  {
    id: 'general',
    titulo: 'General',
    opciones: [{ texto: 'Inicio', ruta: '/', icono: 'inicio' }],
  },
  {
    id: 'administracion',
    titulo: 'Administración',
    // En este orden: Usuarios, Roles, Bitácora (maqueta aprobada el 2026-11-06; sin «Empresa»
    // desde el 6.15b: se renombra con `pnpm admin:renombrar-empresa`).
    opciones: [
      { texto: 'Usuarios', ruta: '/usuarios', icono: 'usuarios', permiso: 'auth.usuario.ver' },
      { texto: 'Roles', ruta: '/roles', icono: 'roles', permiso: 'auth.rol.ver' },
      {
        texto: 'Bitácora',
        ruta: '/bitacora',
        icono: 'bitacora',
        permiso: 'auditoria.evento.ver',
      },
    ],
  },
];
