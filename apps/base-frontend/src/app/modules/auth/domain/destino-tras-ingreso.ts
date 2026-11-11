/** A dónde se va después de entrar si no se pidió otra pantalla. */
export const DESTINO_POR_DEFECTO = '/';

/** Las pantallas de la sesión misma: nunca son el destino al que se vuelve. */
export const RUTA_LOGIN = '/login';
export const RUTA_CONTRASENA_TEMPORAL = '/contrasena-temporal';
export const RUTA_CAMBIAR_CONTRASENA = '/cambiar-contrasena';
const RUTAS_DE_SESION = [RUTA_LOGIN, RUTA_CONTRASENA_TEMPORAL, RUTA_CAMBIAR_CONTRASENA];

/**
 * La pantalla a la que se vuelve después de entrar o de cambiar la contraseña
 * (`/login?volver=/usuarios`). Solo rutas de esta aplicación: si no empieza con una sola `/` (o es
 * una de las pantallas de la sesión), al inicio. Así nadie arma un enlace que, después de entrar,
 * lleve a otro sitio, y no se vuelve a una pantalla que ya no corresponde.
 */
export function destinoTrasIngreso(volver: string | null | undefined): string {
  if (typeof volver !== 'string') return DESTINO_POR_DEFECTO;
  const ruta = volver.trim();
  if (!ruta.startsWith('/') || ruta.startsWith('//') || ruta.includes('\\')) {
    return DESTINO_POR_DEFECTO;
  }
  if (
    RUTAS_DE_SESION.some((r) => ruta === r || ruta.startsWith(`${r}?`) || ruta.startsWith(`${r}/`))
  ) {
    return DESTINO_POR_DEFECTO;
  }
  return ruta;
}

/**
 * El `volver` para llevar en la dirección desde la pantalla `actual`: `null` si no hace falta (el
 * inicio) o si no es una pantalla a la que se pueda volver.
 */
export function volverDesde(actual: string): string | null {
  const destino = destinoTrasIngreso(actual);
  return destino === DESTINO_POR_DEFECTO ? null : destino;
}
