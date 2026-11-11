const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Un id que no es UUID haría fallar a PostgreSQL (500): el repositorio lo trata como "no existe". */
export function esUuid(id: string): boolean {
  return PATRON_UUID.test(id);
}
