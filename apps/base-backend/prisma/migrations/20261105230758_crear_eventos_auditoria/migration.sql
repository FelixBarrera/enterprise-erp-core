-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auditoria";

-- CreateTable
CREATE TABLE "auditoria"."eventos" (
    "id" UUID NOT NULL,
    "ocurrido_en" TIMESTAMPTZ(6) NOT NULL,
    "empresa_id" UUID,
    "usuario_id" UUID,
    "nombre_usuario" VARCHAR(50),
    "accion" VARCHAR(100) NOT NULL,
    "entidad" VARCHAR(60),
    "entidad_id" UUID,
    "antes" JSONB,
    "despues" JSONB,
    "ip" VARCHAR(45),
    "navegador" VARCHAR(300),
    "request_id" VARCHAR(64),

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_empresa_ocurrido_idx" ON "auditoria"."eventos"("empresa_id", "ocurrido_en" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "eventos_empresa_entidad_idx" ON "auditoria"."eventos"("empresa_id", "entidad", "entidad_id", "ocurrido_en" DESC);

-- CreateIndex
CREATE INDEX "eventos_empresa_usuario_idx" ON "auditoria"."eventos"("empresa_id", "usuario_id", "ocurrido_en" DESC);

-- ─── Escrito a mano (docs/modulos/auditoria.md) ───

-- La acción tiene la forma modulo.recurso.accion (minúsculas, números y guion bajo).
ALTER TABLE "auditoria"."eventos"
  ADD CONSTRAINT "eventos_accion_formato_chk"
  CHECK ("accion" ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$');

-- O la entidad con su id, o ninguno de los dos.
ALTER TABLE "auditoria"."eventos"
  ADD CONSTRAINT "eventos_entidad_completa_chk"
  CHECK (("entidad" IS NULL) = ("entidad_id" IS NULL));

-- Sin textos vacíos (se guarda null, nunca '').
ALTER TABLE "auditoria"."eventos"
  ADD CONSTRAINT "eventos_textos_no_vacios_chk"
  CHECK (
    ("nombre_usuario" IS NULL OR btrim("nombre_usuario") <> '')
    AND ("entidad" IS NULL OR btrim("entidad") <> '')
    AND ("ip" IS NULL OR btrim("ip") <> '')
    AND ("navegador" IS NULL OR btrim("navegador") <> '')
    AND ("request_id" IS NULL OR btrim("request_id") <> '')
  );

-- antes y despues, si vienen, son objetos JSON ({ campo: valor }).
ALTER TABLE "auditoria"."eventos"
  ADD CONSTRAINT "eventos_cambios_objeto_chk"
  CHECK (
    ("antes" IS NULL OR jsonb_typeof("antes") = 'object')
    AND ("despues" IS NULL OR jsonb_typeof("despues") = 'object')
  );

-- Inmutable (AUD-D1): nadie modifica, borra ni vacía la bitácora.
-- La segunda barrera (el usuario de la aplicación solo con INSERT y SELECT) va en producción.
CREATE FUNCTION "auditoria"."impedir_cambios_bitacora"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría no se puede modificar ni borrar (%)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

CREATE TRIGGER "eventos_sin_cambios"
  BEFORE UPDATE OR DELETE ON "auditoria"."eventos"
  FOR EACH ROW EXECUTE FUNCTION "auditoria"."impedir_cambios_bitacora"();

CREATE TRIGGER "eventos_sin_vaciar"
  BEFORE TRUNCATE ON "auditoria"."eventos"
  FOR EACH STATEMENT EXECUTE FUNCTION "auditoria"."impedir_cambios_bitacora"();
