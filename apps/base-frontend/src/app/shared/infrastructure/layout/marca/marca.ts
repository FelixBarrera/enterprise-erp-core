/**
 * Los textos de la marca de este proyecto (DOM-01, docs/arquitectura-frontend.md, 8.6): el nombre,
 * cómo se parte en el logo y lo que dice el lado de la marca del login. Es lo único de las
 * pantallas que nombra el proyecto o su rubro (CLAUDE.md, sección 1.1). Fuera de TypeScript, el
 * nombre también está en `index.html`, `manifest.webmanifest` y los SVG de `public/marca/`.
 */
export const MARCA = {
  /** El nombre que ve el usuario (pestaña, pie, avisos, lector de pantalla). */
  nombre: 'Base ERP',
  /** El logo: el nombre en negrita y la sigla en el color de acento (puede quedar vacía). */
  logo: { nombre: 'Base', sigla: 'ERP' },
  /** El lado de la marca del login. */
  login: {
    antetitulo: 'Sistema de gestión',
    lema: 'La gestión de su empresa, en un solo lugar.',
    descripcion: 'Usuarios, roles y permisos, y la bitácora de cada cambio.',
  },
} as const;
