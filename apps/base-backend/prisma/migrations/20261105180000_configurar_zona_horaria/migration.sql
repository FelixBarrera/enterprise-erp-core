-- Zona horaria por defecto de la base: America/Guayaquil.
-- Así cualquier herramienta (psql, DBeaver, Power BI) muestra la hora local.
-- El backend NO usa esta zona: su conexión va siempre en UTC (crearAdaptadorPg).
-- Se usa el nombre de la base actual porque cambia por ambiente (desarrollo, pruebas, CI).
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Guayaquil');
END
$$;
