import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Única forma de crear la conexión a PostgreSQL. Nunca usar `new PrismaPg()` directo.
 *
 * La conexión va SIEMPRE en UTC: `@prisma/adapter-pg` lo supone. Con otra zona,
 * los instantes se guardarían corridos 5 horas sin que nada lo avise.
 * La hora local (America/Guayaquil, o la de la instalación) es solo la zona por defecto de la base,
 * para quien la mire con otras herramientas (docs/modelo-datos.md, sección 7).
 */
export function crearAdaptadorPg(connectionString: string): PrismaPg {
  return new PrismaPg({ connectionString, options: '-c TimeZone=UTC' });
}
