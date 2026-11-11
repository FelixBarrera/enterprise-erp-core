-- CreateEnum
CREATE TYPE "seguridad"."motivo_cierre_sesion" AS ENUM ('SALIDA', 'CAMBIO_CONTRASENA', 'REUSO', 'ADMINISTRADOR', 'USUARIO_DESACTIVADO', 'EMPRESA_DESACTIVADA', 'ACCESO_QUITADO');

-- CreateTable
CREATE TABLE "seguridad"."sesiones" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "hash_refresh" CHAR(64) NOT NULL,
    "hash_refresh_anterior" CHAR(64),
    "rotado_en" TIMESTAMPTZ(6),
    "iniciada_en" TIMESTAMPTZ(6) NOT NULL,
    "vence_en" TIMESTAMPTZ(6) NOT NULL,
    "ultimo_uso_en" TIMESTAMPTZ(6) NOT NULL,
    "cerrada_en" TIMESTAMPTZ(6),
    "motivo_cierre" "seguridad"."motivo_cierre_sesion",
    "ip" VARCHAR(45),
    "navegador" VARCHAR(300),

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "seguridad"."sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "seguridad"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguridad"."sesiones" ADD CONSTRAINT "sesiones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "organizacion"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Escrito a mano (docs/modulos/auth-usuarios.md, sección 3) ───

-- Las abiertas de un usuario (cerrar todas: reuso, cambio de contraseña, desactivar) y de una
-- empresa (cerrar las de una empresa desactivada). Parciales: las cerradas no se buscan.
-- Sirven también de índice de las dos FK: usuarios y empresas nunca se borran (regla 12), así
-- que la FK no necesita buscar entre las cerradas.
CREATE INDEX "sesiones_usuario_abiertas_idx"
  ON "seguridad"."sesiones" ("usuario_id")
  WHERE "cerrada_en" IS NULL;

CREATE INDEX "sesiones_empresa_abiertas_idx"
  ON "seguridad"."sesiones" ("empresa_id")
  WHERE "cerrada_en" IS NULL;

-- Cerrada si y solo si tiene motivo.
ALTER TABLE "seguridad"."sesiones"
  ADD CONSTRAINT "sesiones_cierre_con_motivo_chk"
  CHECK (("cerrada_en" IS NULL) = ("motivo_cierre" IS NULL));

-- Vence después de empezar; el último uso no es anterior al inicio.
ALTER TABLE "seguridad"."sesiones"
  ADD CONSTRAINT "sesiones_fechas_chk"
  CHECK ("vence_en" > "iniciada_en" AND "ultimo_uso_en" >= "iniciada_en");

-- El hash anterior y el momento en que se rotó van juntos.
ALTER TABLE "seguridad"."sesiones"
  ADD CONSTRAINT "sesiones_rotacion_chk"
  CHECK (("hash_refresh_anterior" IS NULL) = ("rotado_en" IS NULL));

-- SHA-256 en hexadecimal (64 caracteres): nunca el secreto en claro.
ALTER TABLE "seguridad"."sesiones"
  ADD CONSTRAINT "sesiones_hash_formato_chk"
  CHECK ("hash_refresh" ~ '^[0-9a-f]{64}$'
    AND ("hash_refresh_anterior" IS NULL OR "hash_refresh_anterior" ~ '^[0-9a-f]{64}$'));

-- IP y navegador: con texto o null (nunca '').
ALTER TABLE "seguridad"."sesiones"
  ADD CONSTRAINT "sesiones_ip_navegador_no_vacios_chk"
  CHECK (("ip" IS NULL OR length("ip") > 0) AND ("navegador" IS NULL OR length("navegador") > 0));
