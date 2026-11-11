-- CreateTable
CREATE TABLE "seguridad"."permisos" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(150) NOT NULL,
    "obsoleto" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguridad"."roles_permisos" (
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" UUID,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "seguridad"."permisos"("codigo");

-- CreateIndex
CREATE INDEX "roles_permisos_permiso_id_idx" ON "seguridad"."roles_permisos"("permiso_id");

-- AddForeignKey
ALTER TABLE "seguridad"."roles_permisos" ADD CONSTRAINT "roles_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "seguridad"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguridad"."roles_permisos" ADD CONSTRAINT "roles_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "seguridad"."permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Escrito a mano (docs/modulos/auth-usuarios.md, sección 3) ───

-- El código del permiso: modulo.recurso.accion, en minúsculas (el dominio ya lo revisa).
ALTER TABLE "seguridad"."permisos"
  ADD CONSTRAINT "permisos_codigo_formato_chk"
  CHECK ("codigo" ~ '^[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+$');

ALTER TABLE "seguridad"."permisos"
  ADD CONSTRAINT "permisos_descripcion_no_vacia_chk"
  CHECK (length(btrim("descripcion")) > 0);

-- El Administrador tiene todos los permisos por su marca (AUTH-D10): no lleva filas aquí. Si las
-- tuviera, quitarle una no le quitaría nada y la pantalla mostraría algo que no es cierto.
CREATE FUNCTION "seguridad"."impedir_permisos_administrador"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "seguridad"."roles" r
    WHERE r."id" = NEW."rol_id" AND r."es_administrador"
  ) THEN
    RAISE EXCEPTION 'El rol Administrador tiene todos los permisos: no lleva permisos sueltos'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "roles_permisos_sin_administrador"
  BEFORE INSERT OR UPDATE ON "seguridad"."roles_permisos"
  FOR EACH ROW EXECUTE FUNCTION "seguridad"."impedir_permisos_administrador"();
