-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "seguridad";

-- CreateTable
CREATE TABLE "seguridad"."usuarios" (
    "id" UUID NOT NULL,
    "nombre_usuario" VARCHAR(50) NOT NULL,
    "nombre_completo" VARCHAR(150) NOT NULL,
    "hash_contrasena" VARCHAR(255) NOT NULL,
    "debe_cambiar_contrasena" BOOLEAN NOT NULL DEFAULT true,
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(6),
    "ultima_empresa_id" UUID,
    "ultimo_ingreso_en" TIMESTAMPTZ(6),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" UUID,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,
    "actualizado_por" UUID,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguridad"."roles" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(250),
    "es_administrador" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" UUID,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,
    "actualizado_por" UUID,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguridad"."usuarios_roles" (
    "usuario_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" UUID,

    CONSTRAINT "usuarios_roles_pkey" PRIMARY KEY ("usuario_id","rol_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_nombre_usuario_key" ON "seguridad"."usuarios"("nombre_usuario");

-- CreateIndex
CREATE INDEX "usuarios_ultima_empresa_id_idx" ON "seguridad"."usuarios"("ultima_empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_empresa_id_id_key" ON "seguridad"."roles"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "usuarios_roles_empresa_id_usuario_id_idx" ON "seguridad"."usuarios_roles"("empresa_id", "usuario_id");

-- CreateIndex
CREATE INDEX "usuarios_roles_rol_id_idx" ON "seguridad"."usuarios_roles"("rol_id");

-- AddForeignKey
ALTER TABLE "seguridad"."usuarios" ADD CONSTRAINT "usuarios_ultima_empresa_id_fkey" FOREIGN KEY ("ultima_empresa_id") REFERENCES "organizacion"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguridad"."roles" ADD CONSTRAINT "roles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "organizacion"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguridad"."usuarios_roles" ADD CONSTRAINT "usuarios_roles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "seguridad"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguridad"."usuarios_roles" ADD CONSTRAINT "usuarios_roles_empresa_id_rol_id_fkey" FOREIGN KEY ("empresa_id", "rol_id") REFERENCES "seguridad"."roles"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Escrito a mano (docs/modulos/auth-usuarios.md, sección 3) ───

-- Usuarios: el formato del nombre de usuario (AUTH-D3; el dominio ya lo pasa a minúsculas),
-- sin nombres vacíos y sin intentos negativos.
ALTER TABLE "seguridad"."usuarios"
  ADD CONSTRAINT "usuarios_nombre_usuario_formato_chk"
  CHECK ("nombre_usuario" ~ '^[a-z0-9._-]{3,50}$');

ALTER TABLE "seguridad"."usuarios"
  ADD CONSTRAINT "usuarios_nombre_completo_no_vacio_chk"
  CHECK (length(btrim("nombre_completo")) > 0);

ALTER TABLE "seguridad"."usuarios"
  ADD CONSTRAINT "usuarios_intentos_fallidos_chk"
  CHECK ("intentos_fallidos" >= 0);

-- Roles: nombre único entre los activos de la empresa, sin importar mayúsculas ni tildes.
CREATE UNIQUE INDEX "roles_nombre_activos_key"
  ON "seguridad"."roles" ("empresa_id", public.nombre_normalizado("nombre"))
  WHERE "activo";

-- Un solo rol Administrador por empresa (AUTH-D10).
CREATE UNIQUE INDEX "roles_administrador_key"
  ON "seguridad"."roles" ("empresa_id")
  WHERE "es_administrador";

-- El Administrador no se desactiva (AUTH-D10).
ALTER TABLE "seguridad"."roles"
  ADD CONSTRAINT "roles_administrador_activo_chk"
  CHECK (NOT "es_administrador" OR "activo");

ALTER TABLE "seguridad"."roles"
  ADD CONSTRAINT "roles_nombre_no_vacio_chk"
  CHECK (length(btrim("nombre")) > 0);

-- Descripción: o con texto o null (nunca '').
ALTER TABLE "seguridad"."roles"
  ADD CONSTRAINT "roles_descripcion_no_vacia_chk"
  CHECK ("descripcion" IS NULL OR length(btrim("descripcion")) > 0);
