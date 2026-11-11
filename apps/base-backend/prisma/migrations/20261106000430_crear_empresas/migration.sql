-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "organizacion";

-- CreateTable
CREATE TABLE "organizacion"."empresas" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" UUID,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,
    "actualizado_por" UUID,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- ─── Escrito a mano (docs/modulos/empresas.md, docs/modelo-datos.md sección 6) ───

-- Nombres únicos sin importar mayúsculas ni tildes: minúsculas + unaccent.
-- unaccent(texto) no es IMMUTABLE (depende del diccionario en uso) y un índice lo exige:
-- con el diccionario escrito explícito, el resultado sí es fijo.
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

CREATE FUNCTION public.nombre_normalizado(texto text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT lower(public.unaccent('public.unaccent'::regdictionary, texto))
$$;

-- Único entre las activas: una empresa desactivada no impide crear otra con su nombre.
CREATE UNIQUE INDEX "empresas_nombre_activas_key"
  ON "organizacion"."empresas" (public.nombre_normalizado("nombre"))
  WHERE "activo";

-- Sin nombres vacíos (el dominio ya recorta; la base es el último resguardo).
ALTER TABLE "organizacion"."empresas"
  ADD CONSTRAINT "empresas_nombre_no_vacio_chk"
  CHECK (length(btrim("nombre")) > 0);
