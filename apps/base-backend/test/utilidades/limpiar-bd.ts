import type { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service.js';

/**
 * Vacía todas las tablas de la base de pruebas (menos el registro de migraciones), también la
 * bitácora inmutable. Va en el `beforeEach` de los e2e que escriben. Si la base no termina en
 * `_test`, no hace nada y falla: así nunca puede vaciar la de desarrollo.
 */
export async function limpiarBd(prisma: PrismaService): Promise<void> {
  await asegurarBaseDePruebas(prisma, 'limpiarBd()');
  const tablas = await prisma.$queryRaw<{ tabla: string }[]>`
    SELECT format('%I.%I', schemaname, tablename) AS tabla
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      AND tablename <> '_prisma_migrations'`;
  if (tablas.length === 0) {
    return;
  }
  // Los nombres vienen de PostgreSQL ya escapados con format('%I'): no hay entrada del usuario.
  await vaciarSinTriggers(prisma, tablas.map(({ tabla }) => tabla).join(', '));
}

/**
 * Vacía solo la bitácora: en los e2e que cuentan eventos, después de preparar los datos (así
 * no se cuentan los eventos de la preparación).
 */
export async function vaciarAuditoria(prisma: PrismaService): Promise<void> {
  await asegurarBaseDePruebas(prisma, 'vaciarAuditoria()');
  await vaciarSinTriggers(prisma, 'auditoria.eventos');
}

async function asegurarBaseDePruebas(prisma: PrismaService, quien: string): Promise<void> {
  const [fila] = await prisma.$queryRaw<{ base: string }[]>`SELECT current_database() AS base`;
  if (fila === undefined || !fila.base.endsWith('_test')) {
    throw new Error(`${quien}: la base "${fila?.base ?? '?'}" no es de pruebas (_test)`);
  }
}

/**
 * Los triggers de la bitácora impiden vaciarla. `session_replication_role = replica` los apaga
 * solo en esta transacción (SET LOCAL) y solo en la base de pruebas.
 */
async function vaciarSinTriggers(prisma: PrismaService, lista: string): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRawUnsafe('SET LOCAL session_replication_role = replica'),
    prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`),
  ]);
}
