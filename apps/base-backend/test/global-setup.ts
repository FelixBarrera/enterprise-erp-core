import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { nombreDeBase, urlBaseDePruebas } from './utilidades/base-de-pruebas.js';

const CARPETA_BACKEND = fileURLToPath(new URL('..', import.meta.url));

/**
 * Antes de los e2e: crea la base `_test` si no existe y le aplica las migraciones.
 * La URL ya la calculó `vitest.config.e2e.ts` y la dejó en `DATABASE_URL`.
 */
export default async function prepararBaseDePruebas(): Promise<void> {
  const url = new URL(urlBaseDePruebas({ DATABASE_URL_TEST: process.env['DATABASE_URL'] }));
  const nombre = nombreDeBase(url);

  const mantenimiento = new URL(url);
  mantenimiento.pathname = '/postgres';
  mantenimiento.search = '';
  const cliente = new pg.Client({ connectionString: mantenimiento.toString() });
  await cliente.connect();
  try {
    const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
    if (existe.rowCount === 0) {
      await cliente.query(`CREATE DATABASE ${pg.escapeIdentifier(nombre)}`);
    }
  } finally {
    await cliente.end();
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: CARPETA_BACKEND,
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });
}
