/**
 * Base de datos propia de los e2e: nunca la de desarrollo.
 * - Si existe `DATABASE_URL_TEST`, se usa esa.
 * - Si no, la de `DATABASE_URL` con `_test` al final del nombre (`base_erp` → `base_erp_test`).
 * Si el nombre no termina en `_test`, las pruebas no arrancan.
 */
export function urlBaseDePruebas(entorno: Record<string, string | undefined>): string {
  const explicita = entorno['DATABASE_URL_TEST'];
  const base = entorno['DATABASE_URL'];
  if (explicita === undefined && base === undefined) {
    throw new Error('Pruebas e2e: falta DATABASE_URL (o DATABASE_URL_TEST) en el .env');
  }
  const url = new URL(explicita ?? base ?? '');
  if (explicita === undefined) {
    url.pathname = `${nombreDeBase(url)}_test`;
  }
  const nombre = nombreDeBase(url);
  if (!nombre.endsWith('_test')) {
    throw new Error(
      `Pruebas e2e: la base "${nombre}" no termina en _test. Las pruebas borran datos: ` +
        'nunca se corren contra la base de desarrollo.',
    );
  }
  return url.toString();
}

export function nombreDeBase(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//, ''));
}
